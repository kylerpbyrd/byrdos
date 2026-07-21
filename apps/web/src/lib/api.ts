const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface SignupResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
}

interface SigninResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
}

export async function signupApi(email: string, password: string, name?: string): Promise<SignupResponse> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Signup failed' }));
    throw new Error(error.message || 'Signup failed');
  }

  return res.json();
}

export async function signinApi(email: string, password: string): Promise<SigninResponse> {
  const res = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Signin failed' }));
    throw new Error(error.message || 'Signin failed');
  }

  return res.json();
}
