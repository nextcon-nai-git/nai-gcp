const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {executeAuthorizedAudit,AuditAccessError}=require("./lib/audit.cjs");

exports.auditS2220=onCall({region:"us-central1",memory:"512MiB",cpu:1,minInstances:0,maxInstances:8,timeoutSeconds:60,secrets:["OPENAI_API_KEY","ANTHROPIC_API_KEY"]},async request=>{
  if(!request.auth) throw new HttpsError("unauthenticated","Entre novamente no NAI.");
  const token=request.rawRequest.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  try {
    const result=await executeAuthorizedAudit(token,request.data?.companyId,request.data?.evento);
    if (!result.success) throw new HttpsError("invalid-argument",result.error,result.validationErrors);
    return result.data;
  } catch(error){
    if(error instanceof HttpsError) throw error;
    if(error instanceof AuditAccessError) throw new HttpsError(error.code,error.message);
    throw new HttpsError("internal","Não foi possível concluir a auditoria.");
  }
});
