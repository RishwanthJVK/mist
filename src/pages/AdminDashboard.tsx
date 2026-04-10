import { useState, useEffect } from "react";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  LogOut,
  Trash2,
  ShieldAlert,
  ChevronRight,
  Settings,
  Users
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ParticipantState {
  participant_id: string;
  username: string;
  current_mode: string;
  accuracy: number;
  latest_response_time: number;
  mode_started_at: string;
  updated_at: string;
}

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("--:--");

  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return;

    const tick = () => {
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      if (diff < 0) return;
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="font-mono text-primary font-bold">{elapsed}</span>;
}

// Admin client using service role key — bypasses RLS and can delete auth users.
// Only used for destructive admin operations (delete user, clear data).
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const adminSupabase = serviceRoleKey
  ? createClient(import.meta.env.VITE_SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Global Timer States
  const [globalDuration, setGlobalDuration] = useState("");
  const [globalTimerActive, setGlobalTimerActive] = useState(false);
  const [globalTimeLeft, setGlobalTimeLeft] = useState(0);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchParticipants();
    fetchUsers();

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participant_state" },
        () => fetchParticipants()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Dedicated Global Countdown effect
  useEffect(() => {
    let timer: number;
    if (globalTimerActive && globalTimeLeft > 0) {
      timer = window.setInterval(() => {
        setGlobalTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setGlobalDuration(""); 
            setGlobalTimerActive(false);
            setGlobalMode("REST", "0"); // Force no timer on rollback
            toast({ title: "Global Timer Expired", description: "All participants reverted to REST." });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [globalTimerActive, globalTimeLeft]);

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from("participant_state")
      .select("*")
      .order("updated_at", { ascending: false });

    if (data) setParticipants(data);
    if (error) console.error("Error fetching participants:", error);
  };

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [activeGlobalTrigger, setActiveGlobalTrigger] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!adminSupabase) return;
    const { data, error } = await adminSupabase.auth.admin.listUsers();
    if (data?.users) {
      // Filter for participants (those with @mist.local email)
      const participantsOnly = data.users.filter((u: any) => u.email?.endsWith("@mist.local"));
      setAllUsers(participantsOnly);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSupabase || !editingUser) return;
    try {
      const updates: any = {};
      if (editUsername) {
        updates.email = `${editUsername.toLowerCase()}@mist.local`;
      }
      if (editPassword) {
        updates.password = editPassword;
      }

      const { error } = await adminSupabase.auth.admin.updateUserById(editingUser.id, updates);
      if (error) throw error;

      if (editUsername) {
         await supabase.from("participant_state").update({ username: editUsername }).eq("participant_id", editingUser.id);
      }

      toast({ title: "User Updated", description: `Account for ${editUsername || editingUser.email.split('@')[0]} updated.` });
      setEditingUser(null);
      setEditUsername("");
      setEditPassword("");
      fetchUsers();
      fetchParticipants();
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // Secondary client prevents signup from overwriting admin's session
      const secondarySupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const syntheticEmail = `${newUsername.toLowerCase()}@mist.local`;
      const { data, error } = await secondarySupabase.auth.signUp({
        email: syntheticEmail,
        password: newPassword,
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "participant",
        });
        toast({ title: "Success", description: "Created participant account." });
        setNewUsername("");
        setNewPassword("");
      }
    } catch (error: any) {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
      fetchUsers();
    }
  };

  const setMode = async (participantId: string, mode: string) => {
    const { error } = await supabase
      .from("participant_state")
      .update({ 
        current_mode: mode,
        mode_started_at: new Date().toISOString()
      })
      .eq("participant_id", participantId);

    if (error) {
      toast({ title: "Failed to set mode", description: error.message, variant: "destructive" });
    } else {
      setActiveGlobalTrigger(null);
      toast({ title: `Mode set to ${mode}` });
    }
  };

  const setGlobalMode = async (mode: string, forcedDuration?: string) => {
    if (participants.length === 0) return;
    const ids = participants.map((p) => p.participant_id);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("participant_state")
      .update({ 
        current_mode: mode,
        mode_started_at: now
      })
      .in("participant_id", ids);

    // If a duration is specified (either forced or via state), start the timer
    const durationToUse = forcedDuration !== undefined ? forcedDuration : globalDuration;
    const durationMin = parseInt(durationToUse);
    
    if (!isNaN(durationMin) && durationMin > 0) {
      setGlobalTimerActive(true);
      setGlobalTimeLeft(durationMin * 60);
      toast({ title: `Global Timed Mode: ${mode} for ${durationMin} min` });
    } else {
      setGlobalTimerActive(false);
      setGlobalTimeLeft(0);
      setActiveGlobalTrigger(mode);
      toast({ title: `All sessions set to ${mode}` });
    }

    if (error) {
      toast({ title: "Failed to set global mode", description: error.message, variant: "destructive" });
    }
  };

  const handleRemoveParticipant = async (participantId: string, username: string) => {
    try {
      // 1. Delete all trial data for this participant
      const { error: trialsError } = await supabase
        .from("trials")
        .delete()
        .eq("participant_id", participantId);
      if (trialsError) throw new Error(`Failed to delete trial data: ${trialsError.message}`);

      // 2. Delete from participant_state
      await supabase.from("participant_state").delete().eq("participant_id", participantId);

      // 3. Delete from user_roles
      await supabase.from("user_roles").delete().eq("user_id", participantId);

      // 4. Permanently delete from Supabase Auth (requires service role key)
      if (adminSupabase) {
        const { error: authError } = await adminSupabase.auth.admin.deleteUser(participantId);
        if (authError) throw new Error(`Failed to delete auth user: ${authError.message}`);
        toast({ title: "Participant deleted", description: `"${username}" has been permanently removed.` });
      } else {
        // Graceful degradation: warn if service key is missing
        toast({
          title: "Participant partially removed",
          description: `"${username}" data cleared, but auth deletion failed — add VITE_SUPABASE_SERVICE_ROLE_KEY to .env to fully prevent re-login.`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      if (editingUser?.id === participantId) setEditingUser(null);
      fetchParticipants();
      fetchUsers();
    }
  };

  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      // 1. Clear trials table
      const { error: trialsError } = await supabase.from("trials").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (trialsError) throw trialsError;

      // 2. Reset accuracy for all participants
      const { error: stateError } = await supabase.from("participant_state").update({
        accuracy: 0,
        latest_response_time: 0
      }).neq("participant_id", "00000000-0000-0000-0000-000000000000"); // Update all
      if (stateError) throw stateError;

      toast({ title: "All data cleared", description: "Trials deleted and participant accuracy reset to 0%." });
      fetchParticipants();
    } catch (error: any) {
      toast({ title: "Clear failed", description: error.message, variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex justify-between items-center bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <img src="/mist-head-logo.png" alt="MIST Logo" className="w-12 h-12 object-contain filter drop-shadow-sm" />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Admin <span className="text-primary italic">Dashboard</span>
              </h1>
              <p className="text-slate-500 text-sm mt-1 font-bold uppercase tracking-wider opacity-70">Manage participants and monitor session data.</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Button 
              variant="outline" 
              onClick={() => navigate("/admin/analytics")} 
              className="gap-2 bg-white border-slate-300 text-primary hover:bg-primary hover:text-white rounded-xl font-bold transition-all shadow-sm active:scale-[0.98]"
            >
              <BarChart3 className="w-4 h-4" /> Participant Analytics
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSignOut} 
              className="bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 border-slate-200 text-slate-600 rounded-xl px-5 h-11 transition-all active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>

        {/* Service role key warning */}
        {!serviceRoleKey && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
            ⚠️ <strong>VITE_SUPABASE_SERVICE_ROLE_KEY</strong> is not set in <code>.env</code>.
            Deleting participants will clear their data but they may still be able to log in.
            Get the key from <strong>Supabase → Settings → API → service_role</strong>.
          </div>
        )}

        {/* Global Trigger */}
        <Card className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-lg font-black text-slate-900 uppercase tracking-wider opacity-90">Global Trigger (All Active Participants)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="global-duration" className="text-xs font-black text-slate-500 uppercase tracking-widest">Optional Duration (min)</Label>
                <Input
                  id="global-duration"
                  type="number"
                  placeholder="e.g. 10"
                  value={globalDuration}
                  onChange={(e) => setGlobalDuration(e.target.value)}
                  className="mt-1 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl"
                />
              </div>
              {globalTimerActive && (
                <div className="flex-1 bg-primary/10 border border-primary/20 rounded-xl p-2 text-center animate-pulse">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">TIMER ACTIVE</p>
                  <p className="text-xl font-mono text-primary font-bold tracking-tighter">
                    {Math.floor(globalTimeLeft / 60)}:{(globalTimeLeft % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {["REST", "TRAINING", "CONTROL", "STRESS"].map((mode) => (
                <Button
                  key={mode}
                  variant={activeGlobalTrigger === mode ? "default" : "outline"}
                  onClick={() => setGlobalMode(mode)}
                  disabled={participants.length === 0}
                  className={`font-bold transition-all rounded-xl shadow-sm ${
                    activeGlobalTrigger === mode 
                      ? "bg-primary text-white border-none scale-[1.02] shadow-primary/20" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  Set all to {mode} {globalDuration ? "(Timed)" : ""}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone — Clear All Data */}
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="py-4">
            <CardTitle className="text-lg text-red-700 font-black uppercase tracking-wider">⚠️ Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <div>
              <p className="text-sm font-bold text-red-800">Clear All Collected Data</p>
              <p className="text-xs text-red-600 mt-0.5 font-medium">
                Permanently deletes all trial records for all participants. Accounts are kept.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isClearing}
                  className="shrink-0 font-black uppercase tracking-widest text-xs h-10 px-6 rounded-xl shadow-lg shadow-red-500/20"
                >
                  {isClearing ? "Clearing..." : "Clear All Data"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white border-slate-200 text-slate-900">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black text-red-600 uppercase tracking-tight">Are you absolutely certain?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-500 font-medium">
                    This will permanently delete ALL collected trial data for ALL participants. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                  <AlertDialogCancel className="bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 rounded-xl font-bold">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllData} className="bg-red-600 hover:bg-red-700 text-white font-black rounded-xl">
                    Yes, Clear All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create Participant Form */}
          <Card className="col-span-1 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">Add New Participant</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateParticipant} className="space-y-5">
                <div className="space-y-2.5">
                  <Label className="text-slate-500 font-black uppercase tracking-widest text-[11px] ml-1">Username (ID)</Label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. SUBJ-001"
                    className="h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-primary/20 font-bold"
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label className="text-slate-500 font-black uppercase tracking-widest text-[11px] ml-1">Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-12 bg-white border-slate-200 text-slate-900 rounded-xl focus:ring-primary/20 font-bold"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.15em] text-xs shadow-lg shadow-primary/20 rounded-xl transition-all active:scale-[0.98]" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Participants List */}
          <Card className="col-span-1 md:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
              <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Sessions</CardTitle>
              <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ring-1 ring-primary/20">
                {participants.length} Active
              </span>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="h-48 flex flex-center justify-center items-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                  No active sessions found.
                </div>
              ) : (
                <div className="space-y-4">
                  {participants.map((p) => (
                    <div
                      key={p.participant_id}
                      className="p-5 border border-slate-200 rounded-2xl bg-white flex flex-col gap-5 transition-all hover:border-primary/30 group shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight group-hover:text-primary transition-colors">{p.username}</h3>
                          <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status:</span>
                               <span className="text-xs font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md">{p.current_mode}</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Elapsed:</span>
                               <span className="text-xs font-mono text-primary font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                 <LiveTimer startTime={p.mode_started_at} />
                               </span>
                             </div>
                          </div>
                        </div>
                        

                      </div>

                      <div className="grid grid-cols-4 gap-2.5">
                        {["REST", "TRAINING", "CONTROL", "STRESS"].map((mode) => (
                          <Button
                            key={mode}
                            size="sm"
                            variant={p.current_mode === mode ? "default" : "outline"}
                            onClick={() => setMode(p.participant_id, mode)}
                            className={`h-10 font-black uppercase tracking-widest text-[10px] transition-all rounded-xl ${
                              p.current_mode === mode 
                                ? "bg-primary text-white border-none shadow-md scale-[1.02]" 
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            {mode}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Account Details Section */}
          <Card className="col-span-1 md:col-span-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">User Account Management</CardTitle>
            </CardHeader>
            <CardContent>
              {!serviceRoleKey ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm font-bold italic text-center">
                  Manage accounts requires VITE_SUPABASE_SERVICE_ROLE_KEY.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Existing Participant Accounts
                      </p>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-full ring-1 ring-slate-200 uppercase tracking-widest">
                        {allUsers.length} Logged
                      </span>
                    </div>
                    <div className="border border-slate-200 divide-y divide-slate-200 bg-white rounded-2xl shadow-sm max-h-[450px] overflow-y-auto custom-scrollbar">
                      {allUsers.length === 0 ? (
                        <p className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">No participant accounts found.</p>
                      ) : (
                        allUsers.map((u) => (
                          <div key={u.id} className="p-5 flex justify-between items-center group hover:bg-slate-50 transition-all border-l-4 border-l-transparent hover:border-l-primary">
                            <div>
                              <p className="font-black text-slate-900 uppercase tracking-tight text-lg">{u.email.split('@')[0]}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-tighter">{u.id}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditUsername(u.email.split('@')[0]);
                                  setEditPassword("");
                                }}
                                className="bg-white hover:bg-primary hover:text-white border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest transition-all shadow-sm rounded-xl h-9 px-4"
                              >
                                Edit Details
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-xl shadow-sm border border-slate-200">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white border-slate-200 text-slate-900">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Delete Participant?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-500 font-medium">
                                      Are you sure you want to delete <span className="text-slate-900 font-bold">"{u.email.split('@')[0]}"</span>? This will permanently remove their access and all associated trial data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="gap-3">
                                    <AlertDialogCancel className="bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-xl font-bold">Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleRemoveParticipant(u.id, u.email.split('@')[0])}
                                      className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                                    >
                                      Delete Participant
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {editingUser && (
                    <Card className="bg-white border-2 border-primary/30 shadow-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500">
                      <div className="h-2 w-full bg-primary" />
                      <CardHeader className="pb-4 pt-8 text-center">
                        <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
                          Editing: <span className="text-primary font-mono bg-white px-3 py-1 rounded-lg border border-primary/10 shadow-sm">{editingUser.email.split('@')[0]}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-8 px-8 pb-10">
                        <form onSubmit={handleUpdateUser} className="space-y-6">
                          <div className="space-y-2.5">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1">New Username (ID)</Label>
                            <Input 
                              value={editUsername} 
                              onChange={(e) => setEditUsername(e.target.value)} 
                              placeholder="New username"
                              className="h-14 bg-white border-slate-200 focus:ring-primary/20 text-slate-900 font-bold rounded-xl placeholder:text-slate-400"
                            />
                          </div>
                          <div className="space-y-2.5">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1">Update Password</Label>
                            <Input 
                              type="password" 
                              value={editPassword} 
                              onChange={(e) => setEditPassword(e.target.value)} 
                              placeholder="New password (leave blank to keep)"
                              className="h-14 bg-white border-slate-200 focus:ring-primary/20 text-slate-900 font-bold rounded-xl placeholder:text-slate-400"
                            />
                            <div className="bg-white p-3 rounded-xl border border-slate-200 mt-4 shadow-sm">
                              <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                                Note: Passwords are encrypted and cannot be recovered. You can only set a new one.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-4 pt-4">
                            <Button type="submit" className="flex-1 h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.15em] text-xs shadow-lg shadow-primary/20 rounded-xl transition-all">Save Changes</Button>
                            <Button variant="outline" onClick={() => setEditingUser(null)} className="flex-1 h-14 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-black uppercase tracking-[0.15em] text-xs rounded-xl transition-all">Cancel</Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
