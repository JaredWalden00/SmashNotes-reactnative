import { supabase } from "../lib/supabase";

const USER_PROFILES_TABLE = "user_profiles";

export async function fetchMainCharacterForUser(userId) {
  const { data, error } = await supabase
    .from(USER_PROFILES_TABLE)
    .select("main_character")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.main_character || null;
}

export async function upsertMainCharacterForUser(userId, mainCharacter) {
  const { error } = await supabase.from(USER_PROFILES_TABLE).upsert(
    [
      {
        user_id: userId,
        main_character: mainCharacter || null,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}
