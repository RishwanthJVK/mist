import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdminView, setIsAdminView] = useState(false);
  
  // Participant Login State
  const [username, setUsername] = useState("");
  const [participantPassword, setParticipantPassword] = useState("");
  const [isParticipantLoading, setIsParticipantLoading] = useState(false);

  // Admin Login State
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const handleParticipantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsParticipantLoading(true);
    
    try {
      const syntheticEmail = `${username.toLowerCase()}@mist.local`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: participantPassword,
      });

      if (error) throw error;
      
      // Verify Role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();
        
      if (roleData?.role === 'admin') {
         toast({ title: "Admin detected", description: "Please use the Investigator login portal.", variant: "destructive" });
         await supabase.auth.signOut();
         return;
      }

      toast({ title: "Login Successful", description: `Welcome ${username}` });
      
      await supabase.from('participant_state').upsert({
         participant_id: data.user.id,
         username: username,
      });

      navigate("/session");
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } finally {
      setIsParticipantLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) throw error;

      // Verify Role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (roleError) {
         toast({ title: "Role check failed", description: roleError.message, variant: "destructive", duration: 10000 });
         await supabase.auth.signOut();
         return;
      }

      if (roleData?.role !== 'admin') {
         toast({ 
           title: "Access Denied", 
           description: "You do not have administrative privileges.", 
           variant: "destructive",
           duration: 10000
         });
         await supabase.auth.signOut();
         return;
      }

      toast({ title: "Admin Login Successful", description: "Entering dashboard" });
      navigate("/admin");
    } catch (error: any) {
      toast({ title: "Admin Login failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F1A] relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 -left-10 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] animate-pulse" />
      <div className="absolute bottom-0 -right-10 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px] animate-pulse" />
      
      <div className="w-full max-w-lg p-6 relative z-10">
        <div className="text-center mb-10 space-y-3 animate-in fade-in zoom-in duration-700">
          <h1 className="text-6xl font-extrabold tracking-tight text-white mb-4">
            MIST
          </h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.25em] opacity-80">Montreal Imaging Stress Task</p>
        </div>

        <Card className="border-slate-800/50 bg-[#161D2E]/40 backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden rounded-3xl group">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-blue-500 to-indigo-600 animate-gradient-x" />
          
          <CardHeader className="pb-4 pt-10 text-center">
            <CardTitle className="text-3xl font-black text-white tracking-tight">
              {isAdminView ? "Investigator Portal" : "Login"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-8 pt-4 pb-12 px-10">
            {!isAdminView ? (
              <form onSubmit={handleParticipantLogin} className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="username" className="text-slate-300 text-xs font-black uppercase tracking-wider ml-1">Participant ID</Label>
                    <Input 
                      id="username" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. SUBJ-001" 
                      className="h-14 bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-600 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all text-lg font-medium"
                      required 
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="participantPassword" className="text-slate-300 text-xs font-black uppercase tracking-wider ml-1">Session Password</Label>
                    <Input 
                      id="participantPassword" 
                      type="password"
                      value={participantPassword}
                      onChange={(e) => setParticipantPassword(e.target.value)}
                      className="h-14 bg-slate-900/60 border-slate-800 text-white rounded-2xl focus:ring-primary/20 focus:border-primary transition-all"
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Button type="submit" className="w-full h-14 text-lg font-black group rounded-2xl shadow-lg hover:shadow-primary/20 bg-primary hover:bg-primary/90 transition-all border-none" disabled={isParticipantLoading}>
                    {isParticipantLoading ? (
                      <span className="flex items-center gap-2">Connecting...</span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Enter Session <ArrowRight className="w-6 h-6 group-hover:translate-x-1.5 transition-transform duration-300" />
                      </span>
                    )}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setIsAdminView(true)}
                    className="w-full h-14 text-lg font-bold border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 hover:text-white rounded-2xl transition-all"
                  >
                    <ShieldCheck className="w-5 h-5 mr-3 opacity-60" />
                    Login as Investigator
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAdminLogin} className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="adminEmail" className="text-slate-300 text-xs font-black uppercase tracking-wider ml-1">Investigator Email</Label>
                    <Input 
                      id="adminEmail" 
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@mist.com" 
                      className="h-14 bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-600 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all text-lg font-medium"
                      required 
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="adminPassword" className="text-slate-300 text-xs font-black uppercase tracking-wider ml-1">Password</Label>
                    <Input 
                      id="adminPassword" 
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="h-14 bg-slate-900/60 border-slate-800 text-white rounded-2xl focus:ring-primary/20 focus:border-primary transition-all"
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Button type="submit" variant="secondary" className="w-full h-14 text-lg font-black bg-white hover:bg-slate-200 text-[#0B0F1A] rounded-2xl shadow-xl transition-all border-none" disabled={isAdminLoading}>
                    {isAdminLoading ? "Authenticating..." : "Access Dashboard"}
                  </Button>

                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={() => setIsAdminView(false)}
                    className="w-full h-14 text-base font-bold text-slate-400 hover:text-white hover:bg-slate-800/40 rounded-2xl transition-all"
                  >
                    <ArrowLeft className="w-5 h-5 mr-3 opacity-40 group-hover:-translate-x-1" />
                    Back to Participant Login
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
