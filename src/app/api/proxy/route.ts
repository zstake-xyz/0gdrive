import { NextRequest } from 'next/server';

// 상태 코드를 유효한 범위로 제한하는 함수
function validateStatus(status: number): number {
  if (status >= 200 && status <= 599) {
    return status;
  }
  // 유효하지 않은 상태 코드는 500으로 변환
  console.warn(`[Proxy] Invalid status code ${status}, converting to 500`);
  return 500;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });
  }
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Proxy] Starting GET request to: ${url} (attempt ${attempt}/${maxRetries})`);
      
      // 30분 타임아웃으로 단일 요청
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 minutes
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': '0G-Storage-Web/1.0',
        }
      });
      
      clearTimeout(timeoutId);
      
      // 응답 상태 확인
      if (!response.ok) {
        console.log(`[Proxy] External server error: ${response.status} ${response.statusText}`);
        
        // 504 에러인 경우 재시도
        if (response.status === 504 && attempt < maxRetries) {
          console.log(`[Proxy] 504 error, retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          lastError = new Error(`Server timeout (attempt ${attempt})`);
          continue;
        }
        
        // 500 에러인 경우 외부 서버 응답 내용을 확인
        if (response.status === 500) {
          try {
            const errorText = await response.text();
            console.log(`[Proxy] 500 error response body:`, errorText);
            
            // JSON 응답인지 확인
            if (errorText.trim().startsWith('{')) {
              try {
                const errorJson = JSON.parse(errorText);
                console.log(`[Proxy] 500 error JSON:`, errorJson);
                
                // 외부 서버의 실제 에러 메시지 사용
                return new Response(
                  JSON.stringify({ 
                    error: 'External server error', 
                    status: 500,
                    statusText: 'Internal Server Error',
                    message: errorJson.message || errorJson.error || 'External server is experiencing issues. Please try again later.',
                    details: errorJson
                  }), 
                  { status: 500 }
                );
              } catch (jsonError) {
                // JSON 파싱 실패 시 텍스트 사용
                return new Response(
                  JSON.stringify({ 
                    error: 'External server error', 
                    status: 500,
                    statusText: 'Internal Server Error',
                    message: errorText || 'External server is experiencing issues. Please try again later.'
                  }), 
                  { status: 500 }
                );
              }
            } else {
              // 일반 텍스트 응답
              return new Response(
                JSON.stringify({ 
                  error: 'External server error', 
                  status: 500,
                  statusText: 'Internal Server Error',
                  message: errorText || 'External server is experiencing issues. Please try again later.'
                }), 
                { status: 500 }
              );
            }
          } catch (textError) {
            console.log(`[Proxy] Failed to read 500 error response:`, textError);
            return new Response(
              JSON.stringify({ 
                error: 'External server error', 
                status: 500,
                statusText: 'Internal Server Error',
                message: 'External server is experiencing issues. Please try again later.'
              }), 
              { status: 500 }
            );
          }
        }
        
        // 600 상태 코드는 외부 서버의 특별한 에러 코드로 처리
        if (response.status === 600) {
          console.log(`[Proxy] External server returned status 600 - treating as server error`);
          return new Response(
            JSON.stringify({ 
              error: 'External server error', 
              status: 500,
              statusText: 'Internal Server Error',
              message: 'External server is experiencing issues. Please try again later.'
            }), 
            { status: 500 }
          );
        }
        
        const validStatus = validateStatus(response.status);
        
        return new Response(
          JSON.stringify({ 
            error: 'External server error', 
            status: response.status,
            statusText: response.statusText,
            message: `Server error (${response.status}): ${response.statusText}`
          }), 
          { status: validStatus }
        );
      }

      console.log(`[Proxy] Successfully received response from external server`);
      
      // 대용량 파일 처리를 위한 스트림 방식 응답 전달
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Content-Length가 있는 경우 유지
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        responseHeaders.set('Content-Length', contentLength);
      }
      
      // 대용량 파일인지 확인 (10MB 이상)
      const isLargeFile = contentLength && parseInt(contentLength) > 10 * 1024 * 1024;
      
      if (isLargeFile) {
        console.log(`[Proxy] Large file detected (${contentLength} bytes), using streaming response`);
        
        // 스트리밍 응답으로 처리하여 메모리 사용량 최소화
        const validStatus = validateStatus(response.status);
        return new Response(response.body, {
          status: validStatus,
          headers: responseHeaders,
        });
      } else {
        // 작은 파일은 기존 방식으로 처리
        const validStatus = validateStatus(response.status);
        return new Response(response.body, {
          status: validStatus,
          headers: responseHeaders,
        });
      }
    } catch (err) {
      console.error(`[Proxy] GET Error (attempt ${attempt}):`, err);
      lastError = err as Error;
      
      // 타임아웃 에러인지 확인
      const isTimeout = err instanceof Error && (
        err.name === 'AbortError' || 
        err.message.includes('timeout') ||
        err.message.includes('aborted')
      );
      
      // 메모리 부족 에러인지 확인
      const isMemoryError = err instanceof Error && (
        err.message.includes('memory') ||
        err.message.includes('heap') ||
        err.message.includes('allocation')
      );
      
      // 마지막 시도가 아니고 타임아웃이거나 메모리 에러인 경우 재시도
      if ((isTimeout || isMemoryError) && attempt < maxRetries) {
        console.log(`[Proxy] ${isTimeout ? 'Timeout' : 'Memory'} error, retrying in ${attempt * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }
      
      // 마지막 시도이거나 다른 에러인 경우
      let errorMessage = 'Proxy error';
      if (isTimeout) {
        errorMessage = 'Request timeout - the file may be too large or the server is temporarily unavailable. Please try again later.';
      } else if (isMemoryError) {
        errorMessage = 'Memory error - the file is too large to process. Please try a smaller file or contact support.';
      } else {
        errorMessage = `Proxy error: ${err instanceof Error ? err.message : String(err)}`;
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Proxy error', 
          details: errorMessage,
          isTimeout,
          isMemoryError,
          attempts: attempt
        }), 
        { status: isTimeout ? 504 : (isMemoryError ? 413 : 500) }
      );
    }
  }
  
  // 모든 재시도 실패
  return new Response(
    JSON.stringify({ 
      error: 'Proxy error', 
      details: 'All retry attempts failed',
      attempts: maxRetries
    }), 
    { status: 504 }
  );
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });
  }
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Proxy] Starting POST request to: ${url} (attempt ${attempt}/${maxRetries})`);
      
      // 요청 본문 가져오기
      const body = await req.arrayBuffer();
      
      // 30분 타임아웃으로 단일 요청
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 minutes
      
      // 헤더 처리 개선
      const headers: Record<string, string> = {
        'User-Agent': '0G-Storage-Web/1.0',
      };
      
      // Content-Type이 있는 경우에만 추가
      const contentType = req.headers.get('content-type');
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
      
      // 기타 필요한 헤더만 추가 (host, origin 등은 제외)
      const allowedHeaders = ['authorization', 'x-requested-with'];
      for (const [key, value] of req.headers.entries()) {
        if (allowedHeaders.includes(key.toLowerCase())) {
          headers[key] = value;
        }
      }
      
      console.log(`[Proxy] POST headers:`, headers);
      
      const response = await fetch(url, {
        method: 'POST',
        body: body,
        signal: controller.signal,
        headers: headers
      });
      
      clearTimeout(timeoutId);
      
      // 응답 상태 확인
      if (!response.ok) {
        console.log(`[Proxy] External server error: ${response.status} ${response.statusText}`);
        
        // 504 에러인 경우 재시도
        if (response.status === 504 && attempt < maxRetries) {
          console.log(`[Proxy] 504 error, retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          lastError = new Error(`Server timeout (attempt ${attempt})`);
          continue;
        }
        
        // 500 에러인 경우 외부 서버 응답 내용을 확인
        if (response.status === 500) {
          try {
            const errorText = await response.text();
            console.log(`[Proxy] 500 error response body:`, errorText);
            
            // JSON 응답인지 확인
            if (errorText.trim().startsWith('{')) {
              try {
                const errorJson = JSON.parse(errorText);
                console.log(`[Proxy] 500 error JSON:`, errorJson);
                
                // 외부 서버의 실제 에러 메시지 사용
                return new Response(
                  JSON.stringify({ 
                    error: 'External server error', 
                    status: 500,
                    statusText: 'Internal Server Error',
                    message: errorJson.message || errorJson.error || 'External server is experiencing issues. Please try again later.',
                    details: errorJson
                  }), 
                  { status: 500 }
                );
              } catch (jsonError) {
                // JSON 파싱 실패 시 텍스트 사용
                return new Response(
                  JSON.stringify({ 
                    error: 'External server error', 
                    status: 500,
                    statusText: 'Internal Server Error',
                    message: errorText || 'External server is experiencing issues. Please try again later.'
                  }), 
                  { status: 500 }
                );
              }
            } else {
              // 일반 텍스트 응답
              return new Response(
                JSON.stringify({ 
                  error: 'External server error', 
                  status: 500,
                  statusText: 'Internal Server Error',
                  message: errorText || 'External server is experiencing issues. Please try again later.'
                }), 
                { status: 500 }
              );
            }
          } catch (textError) {
            console.log(`[Proxy] Failed to read 500 error response:`, textError);
            return new Response(
              JSON.stringify({ 
                error: 'External server error', 
                status: 500,
                statusText: 'Internal Server Error',
                message: 'External server is experiencing issues. Please try again later.'
              }), 
              { status: 500 }
            );
          }
        }
        
        // 600 상태 코드는 외부 서버의 특별한 에러 코드로 처리
        if (response.status === 600) {
          console.log(`[Proxy] External server returned status 600 - treating as server error`);
          return new Response(
            JSON.stringify({ 
              error: 'External server error', 
              status: 500,
              statusText: 'Internal Server Error',
              message: 'External server is experiencing issues. Please try again later.'
            }), 
            { status: 500 }
          );
        }
        
        const validStatus = validateStatus(response.status);
        
        return new Response(
          JSON.stringify({ 
            error: 'External server error', 
            status: response.status,
            statusText: response.statusText,
            message: `Server error (${response.status}): ${response.statusText}`
          }), 
          { status: validStatus }
        );
      }

      console.log(`[Proxy] Successfully received POST response from external server`);
      
      // 대용량 파일 처리를 위한 스트림 방식 응답 전달
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Content-Length가 있는 경우 유지
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        responseHeaders.set('Content-Length', contentLength);
      }
      
      const validStatus = validateStatus(response.status);
      return new Response(response.body, {
        status: validStatus,
        headers: responseHeaders,
      });
    } catch (err) {
      console.error(`[Proxy] POST Error (attempt ${attempt}):`, err);
      lastError = err as Error;
      
      // 타임아웃 에러인지 확인
      const isTimeout = err instanceof Error && (
        err.name === 'AbortError' || 
        err.message.includes('timeout') ||
        err.message.includes('aborted')
      );
      
      // 메모리 부족 에러인지 확인
      const isMemoryError = err instanceof Error && (
        err.message.includes('memory') ||
        err.message.includes('heap') ||
        err.message.includes('allocation')
      );
      
      // 마지막 시도가 아니고 타임아웃이거나 메모리 에러인 경우 재시도
      if ((isTimeout || isMemoryError) && attempt < maxRetries) {
        console.log(`[Proxy] ${isTimeout ? 'Timeout' : 'Memory'} error, retrying in ${attempt * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }
      
      // 마지막 시도이거나 다른 에러인 경우
      let errorMessage = 'Proxy error';
      if (isTimeout) {
        errorMessage = 'Request timeout - the file may be too large or the server is temporarily unavailable. Please try again later.';
      } else if (isMemoryError) {
        errorMessage = 'Memory error - the file is too large to process. Please try a smaller file or contact support.';
      } else {
        errorMessage = `Proxy error: ${err instanceof Error ? err.message : String(err)}`;
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Proxy error', 
          details: errorMessage,
          isTimeout,
          isMemoryError,
          attempts: attempt
        }), 
        { status: isTimeout ? 504 : (isMemoryError ? 413 : 500) }
      );
    }
  }
  
  // 모든 재시도 실패
  return new Response(
    JSON.stringify({ 
      error: 'Proxy error', 
      details: 'All retry attempts failed',
      attempts: maxRetries
    }), 
    { status: 504 }
  );
} 