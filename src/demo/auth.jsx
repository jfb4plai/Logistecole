export const AuthProvider = ({ children }) => children;
export const useAuth = () => ({ session: { user: { id: 'u-demo', email: 'demo@ecole.be' } }, ready: true });
