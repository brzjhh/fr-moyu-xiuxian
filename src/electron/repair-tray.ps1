param([int]$OwnerPid,[string]$IconPath)
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class TrayRepair {
 public delegate bool CB(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumWindows(CB cb,IntPtr l);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr h,StringBuilder b,int n);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr LoadImage(IntPtr i,string p,uint t,int x,int y,uint f);
 [DllImport("user32.dll")]static extern bool DestroyIcon(IntPtr i);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct NID{public uint size;public IntPtr hwnd;public uint uid,flags,msg;public IntPtr icon;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)]public string tip;public uint state,mask;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=256)]public string info;public uint version;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=64)]public string title;public uint infoflags;public Guid guid;public IntPtr balloon;}
 [DllImport("shell32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool Shell_NotifyIcon(uint m,ref NID n);
 public static bool Repair(uint pid,string path){IntPtr window=IntPtr.Zero;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);var b=new StringBuilder(256);GetClassName(h,b,256);if(p==pid&&b.ToString()=="Electron_NotifyIconHostWindow")window=h;return true;},IntPtr.Zero);if(window==IntPtr.Zero)return false;var icon=LoadImage(IntPtr.Zero,path,1,32,32,16);if(icon==IntPtr.Zero)return false;var n=new NID();n.size=(uint)Marshal.SizeOf(n);n.hwnd=window;n.uid=2;Shell_NotifyIcon(2,ref n);n.uid=3;n.flags=1|2|4;n.msg=32769;n.icon=icon;n.tip="Chentu - click to open";bool ok=Shell_NotifyIcon(0,ref n);if(!ok)ok=Shell_NotifyIcon(1,ref n);DestroyIcon(icon);Console.WriteLine("Native tray registration="+ok);return ok;}
}
'@
if([TrayRepair]::Repair($OwnerPid,$IconPath)){exit 0}else{exit 1}
