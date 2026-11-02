
const SUPABASE_URL = "https://lwntynhvxgrnofmtjuaw.supabase.co";

// کلید عمومی واقعی پروژه را اینجا قرار بده
const SUPABASE_KEY = "sb_publishable_zPBI15dzUhdzumJV01mJhQ_0sOgc_FX";

if (!window.supabase) {

    console.error("Supabase library is not loaded.");

} else {

    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log("Supabase client initialized successfully.");
}
