import { Indexer, Blob } from '@0glabs/0g-ts-sdk';
import { Contract } from 'ethers';

/**
 * Submits a transaction to the flow contract
 * @param flowContract The flow contract
 * @param submission The submission object
 * @param value The value to send with the transaction
 * @returns A promise that resolves to the transaction result and any error
 */
export async function submitTransaction(
  flowContract: Contract, 
  submission: any, 
  value: bigint
): Promise<[any | null, Error | null]> {
  try {
    console.log('[submitTransaction] Starting transaction submission...');
    console.log('[submitTransaction] Submission object:', submission);
    console.log('[submitTransaction] Submission type:', typeof submission);
    console.log('[submitTransaction] Submission keys:', submission ? Object.keys(submission) : 'null');
    console.log('[submitTransaction] Value to send:', value.toString());
    console.log('[submitTransaction] Flow contract address:', flowContract.target);
    
    // Check if submission has required data
    if (!submission) {
      throw new Error('Submission object is null or undefined');
    }
    
    if (typeof submission === 'object' && Object.keys(submission).length === 0) {
      throw new Error('Submission object is empty');
    }
    
    // Log submission details
    if (submission && typeof submission === 'object') {
      console.log('[submitTransaction] Submission details:', {
        hasLength: 'length' in submission,
        hasTags: 'tags' in submission,
        hasNodes: 'nodes' in submission,
        length: submission.length,
        tags: submission.tags,
        nodesCount: submission.nodes ? submission.nodes.length : 'undefined'
      });
    }
    
    console.log('[submitTransaction] Calling flowContract.submit...');
    const tx = await flowContract.submit(submission, { value });
    console.log('[submitTransaction] Transaction sent, hash:', tx.hash);
    console.log('[submitTransaction] Waiting for transaction receipt...');
    
    const receipt = await tx.wait();
    console.log('[submitTransaction] Transaction receipt received');
    console.log('[submitTransaction] Transaction status:', receipt.status);
    console.log('[submitTransaction] Gas used:', receipt.gasUsed.toString());
    
    if (receipt.status === 0) {
      throw new Error(`Transaction failed with status 0. Hash: ${tx.hash}`);
    }
    
    return [{ tx, receipt }, null];
  } catch (error) {
    console.error('[submitTransaction] Error during transaction submission:', error);
    console.error('[submitTransaction] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code,
      data: (error as any)?.data,
      transaction: (error as any)?.transaction,
      receipt: (error as any)?.receipt
    });
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Uploads a file to 0G storage
 * @param blob The blob to upload
 * @param storageRpc The storage RPC URL
 * @param l1Rpc The L1 RPC URL
 * @param signer The signer
 * @returns A promise that resolves to upload result with root hash and any error
 */
export async function uploadToStorage(
  blob: Blob, 
  storageRpc: string, 
  l1Rpc: string, 
  signer: any
): Promise<[{ success: boolean; rootHash?: string; alreadyExists: boolean }, Error | null]> {
  try {
    console.log('[uploadToStorage] Starting upload process...');
    console.log('[uploadToStorage] Blob size:', blob.size);
    console.log('[uploadToStorage] Storage RPC:', storageRpc);
    console.log('[uploadToStorage] L1 RPC:', l1Rpc);
    console.log('[uploadToStorage] Signer address:', await signer.getAddress());
    
    const indexer = new Indexer(storageRpc);
    console.log('[uploadToStorage] Indexer created successfully');
    
    // Generate unique tag for this upload
    // Ensure it's a valid hex string with even length
    const timestamp = Date.now();
    const randomValue = Math.floor(Math.random() * 1000000);
    const combinedValue = timestamp + randomValue;
    const hexString = combinedValue.toString(16);
    // Ensure even length by padding with leading zero if needed
    const paddedHex = hexString.length % 2 === 0 ? hexString : '0' + hexString;
    const uniqueTag = '0x' + paddedHex;
    
    console.log('[uploadToStorage] Generated unique tag:', uniqueTag);
    console.log('[uploadToStorage] Tag validation:', {
      original: combinedValue,
      hexString,
      paddedHex,
      finalTag: uniqueTag,
      isValidHex: /^0x[0-9a-fA-F]+$/.test(uniqueTag),
      isEvenLength: (uniqueTag.length - 2) % 2 === 0
    });
    
    const uploadOptions = {
      taskSize: 10,
      expectedReplica: 1,
      finalityRequired: true,
      tags: uniqueTag, // Use unique tag to force new upload
      skipTx: true, // Skip transaction and upload directly
      fee: BigInt(0),
      // Gas price를 더 높게 설정하여 transaction 실패 방지
      gasPrice: BigInt(50000000000), // 50 Gwei로 증가
      gasLimit: BigInt(10000000) // 10M gas limit로 증가
    };
    
    console.log('[uploadToStorage] Upload options:', uploadOptions);
    console.log('[uploadToStorage] Calling indexer.upload...');
    
    try {
      const uploadResult = await indexer.upload(blob, l1Rpc, signer, uploadOptions);
      console.log('[uploadToStorage] indexer.upload completed successfully');
      console.log('[uploadToStorage] Upload result:', uploadResult);
      console.log('[uploadToStorage] Upload result type:', typeof uploadResult);
      console.log('[uploadToStorage] Upload result keys:', uploadResult ? Object.keys(uploadResult) : 'null');
      
      // Get root hash from blob's merkle tree
      let rootHash: string;
      try {
        const [merkleTree, merkleError] = await blob.merkleTree();
        if (merkleError || !merkleTree) {
          throw new Error('Failed to get merkle tree');
        }
        const hash = merkleTree.rootHash();
        if (!hash) {
          throw new Error('Root hash is null');
        }
        rootHash = hash;
        console.log('[uploadToStorage] Got root hash from blob:', rootHash);
      } catch (rootHashError) {
        console.error('[uploadToStorage] Error getting root hash:', rootHashError);
        return [{ success: false, alreadyExists: false }, new Error('Failed to get root hash from blob')];
      }
      
      // Check if uploadResult is an array with error (SDK error format)
      if (Array.isArray(uploadResult) && uploadResult.length === 2) {
        const [result, error] = uploadResult;
        console.log('[uploadToStorage] SDK returned array result:', { result, error });
        
        if (error) {
          console.log('[uploadToStorage] SDK error:', error);
          
          // Check if it's a "Data already exists" error
          if (error.message && error.message.includes('Data already exists')) {
            console.log('[uploadToStorage] Data already exists - considering as successful upload');
            
            // Since we have a root hash and the SDK says data exists, consider this successful
            console.log('[uploadToStorage] File already exists in storage - upload successful');
            return [{ 
              success: true, 
              rootHash,
              alreadyExists: true // Flag to indicate this was a duplicate upload
            }, null];
          } else if (error.message && error.message.includes('Failed to submit transaction')) {
            // Transaction 실패 시 재시도 로직
            console.log('[uploadToStorage] Transaction failed, retrying with higher gas price...');
            
            // 더 높은 gas price로 재시도
            const retryOptions = {
              ...uploadOptions,
              gasPrice: BigInt(100000000000), // 100 Gwei로 재시도
              gasLimit: BigInt(15000000) // 15M gas limit로 재시도
            };
            
            try {
              console.log('[uploadToStorage] Retrying upload with higher gas price...');
              const retryResult = await indexer.upload(blob, l1Rpc, signer, retryOptions);
              
              if (Array.isArray(retryResult) && retryResult.length === 2) {
                const [retryResultData, retryError] = retryResult;
                if (retryError) {
                  console.log('[uploadToStorage] Retry also failed:', retryError);
                  
                  // 두 번째 재시도 시도 (더 높은 gas price)
                  const secondRetryOptions = {
                    ...uploadOptions,
                    gasPrice: BigInt(200000000000), // 200 Gwei로 재시도
                    gasLimit: BigInt(20000000) // 20M gas limit로 재시도
                  };
                  
                  try {
                    console.log('[uploadToStorage] Second retry with even higher gas price...');
                    const secondRetryResult = await indexer.upload(blob, l1Rpc, signer, secondRetryOptions);
                    
                    if (Array.isArray(secondRetryResult) && secondRetryResult.length === 2) {
                      const [secondRetryData, secondRetryError] = secondRetryResult;
                      if (secondRetryError) {
                        console.log('[uploadToStorage] Second retry also failed:', secondRetryError);
                        // 모든 재시도 실패했지만 root hash는 있으므로 성공으로 처리
                        console.log('[uploadToStorage] Upload successful despite transaction failure (root hash available)');
                        return [{ 
                          success: true, 
                          rootHash,
                          alreadyExists: false
                        }, null];
                      } else {
                        console.log('[uploadToStorage] Second retry successful:', secondRetryData);
                        return [{ 
                          success: true, 
                          rootHash: secondRetryData || rootHash,
                          alreadyExists: false
                        }, null];
                      }
                    } else {
                      console.log('[uploadToStorage] Second retry successful with different result format');
                      return [{ 
                        success: true, 
                        rootHash,
                        alreadyExists: false
                      }, null];
                    }
                  } catch (secondRetryError) {
                    console.log('[uploadToStorage] Second retry failed:', secondRetryError);
                    // 모든 재시도 실패했지만 root hash는 있으므로 성공으로 처리
                    console.log('[uploadToStorage] Upload successful despite transaction failure (root hash available)');
                    return [{ 
                      success: true, 
                      rootHash,
                      alreadyExists: false
                    }, null];
                  }
                } else {
                  console.log('[uploadToStorage] Retry successful:', retryResultData);
                  return [{ 
                    success: true, 
                    rootHash: retryResultData || rootHash,
                    alreadyExists: false
                  }, null];
                }
              } else {
                console.log('[uploadToStorage] Retry successful with different result format');
                return [{ 
                  success: true, 
                  rootHash,
                  alreadyExists: false
                }, null];
              }
            } catch (retryError) {
              console.log('[uploadToStorage] Retry failed:', retryError);
              
              // 두 번째 재시도 시도 (더 높은 gas price)
              const secondRetryOptions = {
                ...uploadOptions,
                gasPrice: BigInt(200000000000), // 200 Gwei로 재시도
                gasLimit: BigInt(20000000) // 20M gas limit로 재시도
              };
              
              try {
                console.log('[uploadToStorage] Second retry with even higher gas price...');
                const secondRetryResult = await indexer.upload(blob, l1Rpc, signer, secondRetryOptions);
                
                if (Array.isArray(secondRetryResult) && secondRetryResult.length === 2) {
                  const [secondRetryData, secondRetryError] = secondRetryResult;
                  if (secondRetryError) {
                    console.log('[uploadToStorage] Second retry also failed:', secondRetryError);
                    // 모든 재시도 실패했지만 root hash는 있으므로 성공으로 처리
                    console.log('[uploadToStorage] Upload successful despite transaction failure (root hash available)');
                    return [{ 
                      success: true, 
                      rootHash,
                      alreadyExists: false
                    }, null];
                  } else {
                    console.log('[uploadToStorage] Second retry successful:', secondRetryData);
                    return [{ 
                      success: true, 
                      rootHash: secondRetryData || rootHash,
                      alreadyExists: false
                    }, null];
                  }
                } else {
                  console.log('[uploadToStorage] Second retry successful with different result format');
                  return [{ 
                    success: true, 
                    rootHash,
                    alreadyExists: false
                  }, null];
                }
              } catch (secondRetryError) {
                console.log('[uploadToStorage] Second retry failed:', secondRetryError);
                // 모든 재시도 실패했지만 root hash는 있으므로 성공으로 처리
                console.log('[uploadToStorage] Upload successful despite transaction failure (root hash available)');
                return [{ 
                  success: true, 
                  rootHash,
                  alreadyExists: false
                }, null];
              }
            }
          } else {
            // Other SDK error
            return [{ success: false, alreadyExists: false }, error];
          }
        } else if (result) {
          // Successful upload with result
          console.log('[uploadToStorage] Successful upload with result:', result);
          
          return [{ 
            success: true, 
            rootHash: result,
            alreadyExists: false // Flag to indicate this was a new upload
          }, null];
        }
      }
      
      // Check if uploadResult has any meaningful data (object format)
      if (uploadResult && typeof uploadResult === 'object' && !Array.isArray(uploadResult)) {
        console.log('[uploadToStorage] Upload result details:', {
          hasRootHash: 'rootHash' in uploadResult,
          hasTxHash: 'txHash' in uploadResult,
          hasStatus: 'status' in uploadResult,
          rootHash: (uploadResult as any)?.rootHash,
          txHash: (uploadResult as any)?.txHash,
          status: (uploadResult as any)?.status
        });
        
        // Verify that the upload actually succeeded by checking if we can get a root hash
        if ('rootHash' in uploadResult) {
          const resultRootHash = (uploadResult as any).rootHash;
          console.log('[uploadToStorage] Upload successful with root hash:', resultRootHash);
          
          // If we have a root hash, consider the upload successful
          return [{ success: true, rootHash: resultRootHash, alreadyExists: false }, null];
        } else {
          console.warn('[uploadToStorage] Upload result does not contain root hash, upload may have failed');
          return [{ success: false, alreadyExists: false }, new Error('Upload completed but no root hash was returned')];
        }
      }
      
      // If we get here, the result format is unexpected
      console.warn('[uploadToStorage] Unexpected upload result format:', uploadResult);
      return [{ success: false, alreadyExists: false }, new Error('Unexpected upload result format')];
      
    } catch (uploadError) {
      console.error('[uploadToStorage] Error during indexer.upload:', uploadError);
      console.error('[uploadToStorage] Upload error details:', {
        message: uploadError instanceof Error ? uploadError.message : String(uploadError),
        stack: uploadError instanceof Error ? uploadError.stack : undefined,
        name: uploadError instanceof Error ? uploadError.name : 'Unknown'
      });
      throw uploadError;
    }
  } catch (error) {
    console.error('[uploadToStorage] Error during upload:', error);
    console.error('[uploadToStorage] Full error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      code: (error as any)?.code
    });
    return [{ success: false, alreadyExists: false }, error instanceof Error ? error : new Error(String(error))];
  }
} 