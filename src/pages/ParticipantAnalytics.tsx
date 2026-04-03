import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, TrendingUp, Clock, Target } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ParticipantAnalyticsData {
  participant_id: string;
  username: string;
  avg_accuracy: number;
  avg_response_time: number;
  total_trials: number;
}

export default function ParticipantAnalytics() {
  const [analytics, setAnalytics] = useState<ParticipantAnalyticsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const { data: trials, error: trialsError } = await supabase
        .from("trials")
        .select("*");

      if (trialsError) throw trialsError;

      const { data: participants, error: participantsError } = await supabase
        .from("participant_state")
        .select("participant_id, username");

      if (participantsError) throw participantsError;

      const statsMap: Record<string, { correct: number; total: number; rt_sum: number }> = {};
      
      trials.forEach((t) => {
        if (!statsMap[t.participant_id]) {
          statsMap[t.participant_id] = { correct: 0, total: 0, rt_sum: 0 };
        }
        statsMap[t.participant_id].total += 1;
        if (t.is_correct) statsMap[t.participant_id].correct += 1;
        statsMap[t.participant_id].rt_sum += Number(t.response_time_ms);
      });

      const result: ParticipantAnalyticsData[] = participants.map((p) => {
        const stats = statsMap[p.participant_id] || { correct: 0, total: 0, rt_sum: 0 };
        return {
          participant_id: p.participant_id,
          username: p.username,
          avg_accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
          avg_response_time: stats.total > 0 ? stats.rt_sum / stats.total : 0,
          total_trials: stats.total,
        };
      });

      setAnalytics(result);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/admin")} className="rounded-full w-10 h-10 p-0 hover:bg-slate-100 transition-colors">
               <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Participant <span className="text-primary italic">Analytics</span>
              </h1>
              <p className="text-slate-500 text-sm font-medium">Aggregated historical research performance data.</p>
            </div>
          </div>
          <Button onClick={fetchAnalytics} variant="outline" className="gap-2 border-slate-200 hover:bg-slate-50 rounded-xl font-bold">
             <BarChart3 className="w-4 h-4" /> Refresh Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
              <div className="h-1 w-full bg-emerald-500/80" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-5">
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-[0.1em]">Top Performed Accuracy</CardTitle>
                <div className="p-2 bg-emerald-50 rounded-lg group-hover:scale-110 transition-transform">
                  <Target className="w-4 h-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="text-3xl font-black text-slate-900 tracking-tighter">
                  {analytics.length > 0 ? Math.round(Math.max(...analytics.map(a => a.avg_accuracy)) * 100) : 0}%
                </div>
              </CardContent>
           </Card>

           <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
              <div className="h-1 w-full bg-blue-500/80" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-5">
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-[0.1em]">Global Avg Resp Time</CardTitle>
                <div className="p-2 bg-blue-50 rounded-lg group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="text-3xl font-black text-slate-900 tracking-tighter">
                  {analytics.length > 0 ? Math.round(analytics.reduce((acc, curr) => acc + curr.avg_response_time, 0) / analytics.length) : 0}<span className="text-sm ml-1 text-slate-400">ms</span>
                </div>
              </CardContent>
           </Card>

           <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
              <div className="h-1 w-full bg-indigo-500/80" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-5">
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-[0.1em]">Total Recorded Trials</CardTitle>
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="text-3xl font-black text-slate-900 tracking-tighter">
                  {analytics.reduce((acc, curr) => acc + curr.total_trials, 0).toLocaleString()}
                </div>
              </CardContent>
           </Card>
        </div>

        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden border-none shadow-xl">
          <CardHeader className="bg-white border-b border-slate-100 p-6">
            <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Investigator Dataset</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="font-bold text-slate-900 h-14 pl-6">Participant ID</TableHead>
                    <TableHead className="font-bold text-center text-slate-900 h-14">Trials Logged</TableHead>
                    <TableHead className="font-bold text-center text-slate-900 h-14">Avg. Accuracy</TableHead>
                    <TableHead className="font-bold text-center text-slate-900 h-14">Avg. Resp Time</TableHead>
                    <TableHead className="font-bold text-right text-slate-900 h-14 pr-8">Performance Metric</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                        <span className="flex flex-col items-center gap-3">
                           <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                           Synchronizing database...
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : analytics.length === 0 ? (
                    <TableRow>
                       <TableCell colSpan={5} className="h-64 text-center text-slate-400 font-medium">
                          No trial data recorded yet.
                       </TableCell>
                    </TableRow>
                  ) : (
                    analytics.map((row) => (
                      <TableRow key={row.participant_id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 group">
                        <TableCell className="font-black text-slate-900 uppercase tracking-tight pl-6 text-base">{row.username}</TableCell>
                        <TableCell className="text-center">
                           <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-lg text-sm transition-colors group-hover:bg-slate-200">
                              {row.total_trials}
                           </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black shadow-sm ${
                            row.avg_accuracy > 0.8 ? 'bg-emerald-500 text-white' : 
                            row.avg_accuracy > 0.5 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                            {Math.round(row.avg_accuracy * 100)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-mono font-black text-primary text-base">
                          {Math.round(row.avg_response_time)} <span className="text-[10px] text-slate-400 font-normal">ms</span>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                           <div className="flex items-center justify-end gap-3">
                              <div className="w-32 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner ring-1 ring-black/5">
                                 <div 
                                   className={`h-full transition-all duration-1000 ${
                                     row.avg_accuracy > 0.8 ? 'bg-emerald-500' : 
                                     row.avg_accuracy > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                   }`}
                                   style={{ width: `${Math.min(100, (row.avg_accuracy * 100))}%` }} 
                                 />
                              </div>
                           </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
