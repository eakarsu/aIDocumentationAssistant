import type {NextApiRequest,NextApiResponse} from 'next';

export async function withAiRequest<T>(req:NextApiRequest,res:NextApiResponse,work:(signal:AbortSignal)=>Promise<T>):Promise<T> {
  const controller=new AbortController();
  const aborted=()=>controller.abort(new DOMException('AI request cancelled','AbortError'));
  const closed=()=>{if(!res.writableEnded)aborted();};
  req.once('aborted',aborted);res.once('close',closed);
  if(req.aborted||res.destroyed)aborted();
  try{controller.signal.throwIfAborted();return await work(controller.signal);}
  finally{req.removeListener('aborted',aborted);res.removeListener('close',closed);}
}

export function aiFailureStatus(error:unknown) {
  return error instanceof DOMException && error.name==='AbortError'?499:
    typeof error==='object'&&error!==null&&'status' in error&&typeof error.status==='number'?error.status:502;
}
