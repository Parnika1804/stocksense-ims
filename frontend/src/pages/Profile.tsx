import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  const initials = user?.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <div className="flex flex-col gap-8 max-w-sm animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-100 tracking-tight">My Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-900/30">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-slate-100 text-lg leading-tight">{user?.name}</p>
          <p className="text-sm text-slate-500 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-[#161b27] border border-[#2a3347] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#2a3347]">
        {[
          { label: 'Name',  value: user?.name },
          { label: 'Email', value: user?.email },
          { label: 'Role',  value: user?.role,  mono: false, capitalize: true },
        ].map(({ label, value, capitalize }) => (
          <div key={label} className="px-5 py-4 flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">{label}</span>
            <span className={`text-sm text-slate-200 font-medium ${capitalize ? 'capitalize' : ''}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
