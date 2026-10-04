"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Eye, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MedicalAuditLogger, MedicalAuditEntry } from "@/lib/medical-audit-logger";

export function AuditTrailView() {
  const [logs, setLogs] = useState<MedicalAuditEntry[]>([]);

  useEffect(() => {
    // Carrega logs de auditoria médica
    const initialTrail = MedicalAuditLogger.getAuditTrail();
    if (initialTrail.length === 0) {
      // Registra acesso de exemplo se estiver vazio
      const sample = MedicalAuditLogger.logAccess({
        userId: "doc_102",
        userName: "Dr. Roberto Bruzamolin",
        userRole: "DOCTOR",
        userCrmCoren: "CRM/PR 24890",
        action: "READ_PRONTUARIO",
        patientEmployeeId: "emp_881",
        patientName: "",
        companyId: "comp_1",
        ipAddress: "189.23.41.102",
      });
      setLogs([sample]);
    } else {
      setLogs(initialTrail);
    }
  }, []);

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-800">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-200">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Rastreabilidade & Audit Log Médico (CFM / LGPD)
        </CardTitle>
        <Badge
          variant="outline"
          className="bg-emerald-950 text-emerald-400 border-emerald-800 text-xs"
        >
          Imutável & Criptografado
        </Badge>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-900 rounded-md border border-slate-800 text-slate-300">
                  {log.action === "READ_PRONTUARIO" && <Eye className="h-4 w-4 text-sky-400" />}
                  {log.action === "CREATE_ASO" && <FileText className="h-4 w-4 text-emerald-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-100">{log.userName}</span>
                    {log.userCrmCoren && (
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                        {log.userCrmCoren}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Acessou prontuário de{" "}
                    <strong className="text-slate-200">{log.patientName}</strong> ({log.action})
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-mono">
                <div>{new Date(log.timestamp).toLocaleString("pt-BR")}</div>
                <div>IP: {log.ipAddress}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
