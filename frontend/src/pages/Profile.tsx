import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6 max-w-sm">
      <h1 className="text-xl font-semibold text-white">My Profile</h1>

      <div className="bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700">
        <div className="px-5 py-4 flex flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-slate-500">Name</span>
          <span className="text-white font-medium">{user?.name}</span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-slate-500">Email</span>
          <span className="text-white">{user?.email}</span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-slate-500">Role</span>
          <span className="text-slate-300 capitalize">{user?.role}</span>
        </div>
      </div>
    </div>
  );
}
