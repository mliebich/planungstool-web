import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if URL is a valid HTTP/HTTPS URL
const isValidUrl = (url: string | undefined): boolean => {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
};

const hasValidConfig = isValidUrl(supabaseUrl) && !!supabaseAnonKey;

let supabaseInstance: SupabaseClient | null = null;

if (hasValidConfig && supabaseUrl && supabaseAnonKey) {
	supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else if (typeof window !== 'undefined') {
	// Only log in browser to avoid SSR noise
	console.info('Supabase not configured. Cloud sync disabled.');
}

export const supabase = supabaseInstance;

export const isSupabaseConfigured = (): boolean => {
	return hasValidConfig && supabaseInstance !== null;
};
