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

  const fetchUsers = async () => {
    if (!adminSupabase) return;
    const { data, error } = await adminSupabase.auth.admin.listUsers();
    if (data?.users) {
      // Filter for participants (those with @mist.local email)
      const participantsOnly = data.users.filter(u => u.email?.endsWith("@mist.local"));
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
      fetchParticipants();
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
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Investigator <span className="text-primary italic">Dashboard</span>
            </h1>
            <p className="text-slate-800 text-sm mt-1 font-medium">Manage participants and monitor session data.</p>
          </div>
          <div className="flex gap-3 items-center">
            <Button 
              variant="outline" 
              onClick={() => navigate("/admin/analytics")} 
              className="hover:bg-slate-50 border-primary/30 text-primary font-bold shadow-sm rounded-xl px-5 h-11 transition-all hover:scale-[1.02]"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Participant Analytics
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSignOut} 
              className="hover:bg-red-50 hover:text-red-600 hover:border-red-200 border-slate-200 rounded-xl px-5 h-11 transition-all"
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
        <Card className="bg-slate-100 border-dashed">
          <CardHeader className="py-4">
            <CardTitle className="text-lg text-slate-700">Global Trigger (All Active Participants)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="global-duration" className="text-xs font-bold text-slate-700">Optional Duration (min)</Label>
                <Input
                  id="global-duration"
                  type="number"
                  placeholder="e.g. 10"
                  value={globalDuration}
                  onChange={(e) => setGlobalDuration(e.target.value)}
                  className="mt-1"
                />
              </div>
              {globalTimerActive && (
                <div className="flex-1 bg-amber-100 border border-amber-200 rounded p-2 text-center animate-pulse">
                  <p className="text-xs font-bold text-amber-800">TIMER ACTIVE</p>
                  <p className="text-lg font-mono text-amber-900">
                    {Math.floor(globalTimeLeft / 60)}:{(globalTimeLeft % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {["REST", "TRAINING", "CONTROL", "STRESS"].map((mode) => (
                <Button
                  key={mode}
                  variant="outline"
                  onClick={() => setGlobalMode(mode)}
                  disabled={participants.length === 0}
                >
                  Set all to {mode} {globalDuration ? "(Timed)" : ""}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone — Clear All Data */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="py-4">
            <CardTitle className="text-lg text-red-700">⚠️ Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <div>
              <p className="text-sm font-medium text-red-800">Clear All Collected Data</p>
              <p className="text-xs text-red-600 mt-0.5">
                Permanently deletes all trial records for all participants. Accounts are kept.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isClearing}
                  className="shrink-0"
                >
                  {isClearing ? "Clearing..." : "Clear All Data"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-600">Are you absolutely certain?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL collected trial data for ALL participants. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllData} className="bg-red-600 hover:bg-red-700">
                    Yes, Clear All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create Participant Form */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Add New Participant</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateParticipant} className="space-y-4">
                <div className="space-y-2">
                  <Label>Username (ID)</Label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. SUBJ-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Participants List */}
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-slate-500 text-sm">No participants found.</p>
              ) : (
                <div className="space-y-4">
                  {participants.map((p) => (
                    <div
                      key={p.participant_id}
                      className="p-4 border rounded-lg bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div>
                        <h3 className="font-extrabold text-lg text-slate-900 uppercase tracking-tight">{p.username}</h3>
                        <div className="text-sm text-slate-700 mt-1 flex gap-6 font-medium">
                          <span className="flex items-center gap-2">
                            Session Status: <strong className="text-primary font-black uppercase tracking-widest text-xs">{p.current_mode}</strong>
                            <span className="text-xs text-slate-400 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-full ring-1 ring-slate-200">(<LiveTimer startTime={p.mode_started_at} />)</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex flex-wrap gap-2">
                          {["REST", "TRAINING", "CONTROL", "STRESS"].map((mode) => (
                            <Button
                              key={mode}
                              size="sm"
                              variant={p.current_mode === mode ? "default" : "outline"}
                              onClick={() => setMode(p.participant_id, mode)}
                            >
                              {mode}
                            </Button>
                          ))}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Participant?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{p.username}"? This will permanently remove their access and all associated trial data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleRemoveParticipant(p.participant_id, p.username)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Account Details Section */}
          <Card className="col-span-1 md:col-span-3">
            <CardHeader>
              <CardTitle>User Account Management</CardTitle>
            </CardHeader>
            <CardContent>
              {!serviceRoleKey ? (
                <p className="text-amber-600 text-sm italic">Manage accounts requires VITE_SUPABASE_SERVICE_ROLE_KEY.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 mb-2">Existing participant accounts:</p>
                    <div className="border rounded-lg divide-y bg-white">
                      {allUsers.length === 0 ? (
                        <p className="p-4 text-center text-slate-400">No participant accounts found.</p>
                      ) : (
                        allUsers.map((u) => (
                          <div key={u.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                            <div>
                              <p className="font-bold text-slate-900">{u.email.split('@')[0]}</p>
                              <p className="text-xs text-slate-400">{u.id}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setEditingUser(u);
                                setEditUsername(u.email.split('@')[0]);
                                setEditPassword("");
                              }}
                            >
                              Edit Details
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {editingUser && (
                    <Card className="bg-slate-50 border-primary/20 shadow-lg">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-md">Editing: <span className="text-primary font-mono">{editingUser.email.split('@')[0]}</span></CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs">New Username (ID)</Label>
                            <Input 
                              value={editUsername} 
                              onChange={(e) => setEditUsername(e.target.value)} 
                              placeholder="New username"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Update Password</Label>
                            <Input 
                              type="password" 
                              value={editPassword} 
                              onChange={(e) => setEditPassword(e.target.value)} 
                              placeholder="New password (leave blank to keep)"
                            />
                            <p className="text-[10px] text-slate-400">Passwords are never shown for security. You can only reset them.</p>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button type="submit" className="flex-1">Save Changes</Button>
                            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
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
