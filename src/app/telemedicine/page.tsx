'use client';

import * as React from "react"
import { 
  Video, 
  Calendar, 
  User, 
  Stethoscope, 
  Plus, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Search,
  XCircle,
  AlertCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, where } from "firebase/firestore"
import { agendarConsultaMeet } from "@/actions/telemedicine"
import { cn } from "@/lib/utils"

export default function TelemedicinePage() {
  const { toast } = useToast()
  const { companyId, role } = useUser()
  const db = useFirestore()
  const [isBookingOpen, setIsBookingOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")

  const [formData, setFormData] = React.useState({
    pacienteEmail: "",
    medicoEmail: "doutor.nextcon@nextconsaude.com.br",
    data: "",
    hora: "",
    titulo: "Videoconsulta de Acompanhamento"
  })

  const appointmentsQuery = useMemoFirebase(() => {
    if (!db) return null
    const normalizedRole = (role || '').toUpperCase();
    const privilegedRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'ENGINEER', 'DOCTOR', 'PROVIDER'];
    const hasGlobalView = privilegedRoles.includes(normalizedRole) && !companyId;
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'].includes(normalizedRole);
    if (!hasGlobalView && !isGlobalAdmin && !companyId) return null;

    if (!hasGlobalView && !isGlobalAdmin) {
      return query(
        collection(db, "agendamentos_telemedicina"),
        where("companyId", "==", companyId),
        orderBy("inicio", "desc"),
        limit(50)
      )
    }

    return query(collection(db, "agendamentos_telemedicina"), orderBy("inicio", "desc"), limit(50))
  }, [db, companyId, role])

  const { data: appointments, isLoading } = useCollection(appointmentsQuery)

  async function handleBook() {
    if (!formData.pacienteEmail || !formData.data || !formData.hora) {
      toast({ variant: "destructive", title: "Dados Incompletos", description: "Preencha todos os campos obrigatórios." })
      return
    }
    if (!companyId) {
      toast({ variant: "destructive", title: "Sem vínculo de unidade", description: "Seu usuário não possui companyId para agendamento." })
      return
    }

    setIsSubmitting(true)
    try {
      const localDateTime = new Date(`${formData.data}T${formData.hora}:00`);
      const inicio = `${formData.data}T${formData.hora}:00-03:00`;
      
      const fimData = new Date(localDateTime.getTime() + 30 * 60000);
      // Constructing fim string manually to avoid UTC conversion issues
      const fimHours = String(fimData.getHours()).padStart(2, '0');
      const fimMinutes = String(fimData.getMinutes()).padStart(2, '0');
      const fim = `${formData.data}T${fimHours}:${fimMinutes}:00-03:00`;

      const result = await agendarConsultaMeet({
        pacienteEmail: formData.pacienteEmail,
        medicoEmail: formData.medicoEmail,
        companyId,
        dataHoraInicio: inicio,
        dataHoraFim: fim,
        tituloConsulta: formData.titulo
      })

      if (result.sucesso) {
        toast({ title: "Sala do Meet Gerada!", description: "O link da videoconsulta já está disponível no portal." })
        setIsBookingOpen(false)
        setFormData({ ...formData, pacienteEmail: "", data: "", hora: "" })
      } else {
        toast({ variant: "destructive", title: "Erro no Agendamento", description: result.mensagem })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">Videoconsulta Nextcon</h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest mt-1">Telemedicina integrada com automação Google Meet API.</p>
        </div>
        
        <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-nextcon text-white h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
              <Plus className="size-4" /> Nova Videoconsulta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
            <div className="p-8 bg-primary text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg"><Video className="size-5 text-accent" /></div>
                <DialogTitle className="text-xl font-headline font-black uppercase tracking-tight">Agendar Meet</DialogTitle>
              </div>
              <DialogDescription className="text-white/70 font-medium italic">Geração automática de link Google Meet.</DialogDescription>
            </div>
            
            <div className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail do Paciente</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 size-4 text-slate-300" />
                  <Input 
                    type="email" 
                    placeholder="ex@paciente.com.br" 
                    value={formData.pacienteEmail}
                    onChange={e => setFormData({...formData, pacienteEmail: e.target.value})}
                    className="pl-12 h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Data</label>
                  <Input 
                    type="date" 
                    value={formData.data}
                    onChange={e => setFormData({...formData, data: e.target.value})}
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Horário</label>
                  <Input 
                    type="time" 
                    value={formData.hora}
                    onChange={e => setFormData({...formData, hora: e.target.value})}
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner" 
                  />
                </div>
              </div>

              <Button 
                onClick={handleBook} 
                disabled={isSubmitting}
                className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3 mt-4"
              >
                {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5 text-accent" />}
                Confirmar Agendamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-3.5 size-4 text-slate-300 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Pesquisar por paciente ou e-mail..." 
            className="pl-12 h-12 bg-white border-none shadow-sm rounded-xl font-medium" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center gap-4">
              <Loader2 className="size-12 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Agenda Meet...</p>
            </div>
          ) : appointments && appointments.length > 0 ? (
            <div className="divide-y">
              {appointments.filter(a => a.paciente_email.toLowerCase().includes(searchTerm.toLowerCase())).map((appt) => {
                const date = appt.inicio?.seconds ? new Date(appt.inicio.seconds * 1000) : new Date(appt.inicio);
                return (
                  <div key={appt.id} className="p-6 hover:bg-slate-50 transition-all group flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5 flex-1">
                      <div className="size-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                        <Video className="size-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-sm text-primary uppercase leading-tight">{appt.paciente_email.split('@')[0]}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{appt.paciente_email}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/10 text-primary/60 flex gap-1 items-center">
                            <Calendar className="size-2.5" /> {date.toLocaleDateString('pt-BR')}
                          </Badge>
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/10 text-primary/60 flex gap-1 items-center">
                            <Clock className="size-2.5" /> {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge className={cn(
                        "text-[8px] font-black uppercase border-none px-3 h-6",
                        appt.status === 'agendada' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {appt.status}
                      </Badge>
                      <Button 
                        asChild 
                        className="h-11 px-6 bg-accent hover:bg-accent/90 text-primary font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg gap-2"
                      >
                        <a href={appt.link_meet} target="_blank" rel="noopener noreferrer">
                          Entrar na Sala <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-32 text-center opacity-20 flex flex-col items-center gap-4">
              <Video className="size-16" />
              <div className="space-y-1">
                <p className="font-black uppercase text-sm tracking-widest">Nenhuma videoconsulta agendada</p>
                <p className="text-xs font-bold">Use o botão superior para gerar o primeiro link do Meet.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        <div className="p-6 bg-[#090e24] text-white rounded-[2rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Video className="size-32 text-accent" /></div>
          <div className="relative z-10 space-y-4">
            <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.2em]">Tecnologia Google</Badge>
            <h3 className="text-lg font-black uppercase font-headline">Segurança de Dados</h3>
            <p className="text-xs text-white/60 leading-relaxed font-medium">
              As salas são criptografadas e restritas aos e-mails do médico e paciente. O protocolo HIPAA/LGPD é respeitado através da infraestrutura Google Meet Enterprise.
            </p>
          </div>
        </div>
        <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2rem] flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg text-white shadow-sm"><AlertCircle className="size-4" /></div>
            <h4 className="text-sm font-black text-primary uppercase">Nota Técnica</h4>
          </div>
          <p className="text-[11px] text-primary/70 leading-relaxed font-medium">
            O link do Meet é gerado instantaneamente no ato do agendamento. Tanto o médico quanto o paciente recebem o convite automático se suas contas forem Workspace.
          </p>
        </div>
      </div>
    </div>
  );
}