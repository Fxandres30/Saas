import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://kfxajlqwqofwcufbdbvw.supabase.co"
const supabaseKey = "sb_publishable_i7G5Q0T47stbRusD13e0YQ_B8fyzKmH"

export const supabase = createClient(supabaseUrl, supabaseKey)