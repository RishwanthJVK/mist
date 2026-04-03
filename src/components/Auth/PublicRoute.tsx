import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, LogOut, LayoutDashboard } from "lucide-react";

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsAuthenticated(true);
        // Fetch role to know where to redirect if cancelled
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        setUserRole(roleData?.role || 'participant');
        setShowConfirm(true); 
      } else {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowConfirm(false);
    setIsAuthenticated(false);
  };

  const handleResume = () => {
    if (userRole === 'admin') {
      navigate("/admin");
    } else {
      navigate("/session");
    }
  };

  // If we are checking auth, show nothing or a small loader
  if (isAuthenticated === null) return null;

  return (
    <>
      <AlertDialog open={showConfirm}>
        <AlertDialogContent className="bg-[#161D2E] border-slate-800 text-white shadow-2xl">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
               <div className="p-3 bg-red-500/20 rounded-full ring-2 ring-red-500/50">
                  <ShieldAlert className="w-8 h-8 text-red-500" />
               </div>
            </div>
            <AlertDialogTitle className="text-xl font-black text-center tracking-tight">Active Session Detected</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-center text-base">
              You are currently logged into a session. Returning to the login page is often used to exit. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
            <AlertDialogCancel 
              onClick={handleResume}
              className="flex-1 h-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white rounded-xl font-bold transition-all"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Keep Session
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white border-none rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all font-black"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Confirm Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Only render the login page if not authenticated or if explicit logout happened */}
      {!isAuthenticated && children}
    </>
  );
};
