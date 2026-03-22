import { supabase } from "../lib/supabase";

const USER_PROFILES_TABLE = "user_profiles";

function isMissingProfilesTableError(error) {
  return error?.code === "42P01" || String(error?.message || "").includes("user_profiles");
}

export async function fetchOrCreateUserMain(userId) {
  const { data, error } = await supabase
    .from(USER_PROFILES_TABLE)
    .select("main_character")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingProfilesTableError(error)) {
      return null;
    }

    throw error;
  }

  if (data) {
    return data.main_character || null;
  }

  const { error: insertError } = await supabase.from(USER_PROFILES_TABLE).insert({
    user_id: userId,
    main_character: null,
  });

  if (insertError && insertError.code !== "23505") {
    if (isMissingProfilesTableError(insertError)) {
      return null;
    }

    throw insertError;
  }

  return null;
}

export async function updateUserMain(userId, mainCharacter) {
  const { error } = await supabase
    .from(USER_PROFILES_TABLE)
    .upsert(
      {
        user_id: userId,
        main_character: mainCharacter || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

  if (error) {
    if (isMissingProfilesTableError(error)) {
      return;
    }

    throw error;
  }
}