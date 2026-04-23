import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { validateBody } from "@/lib/validation";

export type LocationPrivacy = "full" | "state_country" | "country_only" | "hidden";

const locationSchema = z.object({
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  privacy: z.enum(["full", "state_country", "country_only", "hidden"]).optional(),
});

export interface UserLocation {
  city: string | null;
  state: string | null;
  country: string | null;
  privacy: LocationPrivacy;
}

// GET - Fetch current user's location
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("location_city, location_state, location_country, location_privacy")
      .eq("clerk_user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching location:", error);
      return NextResponse.json({ error: "Failed to fetch location" }, { status: 500 });
    }

    return NextResponse.json({
      city: profile?.location_city || null,
      state: profile?.location_state || null,
      country: profile?.location_country || null,
      privacy: profile?.location_privacy || "state_country",
    } as UserLocation);
  } catch (error) {
    console.error("Location fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Update current user's location
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validated = validateBody(locationSchema, body);
    if (!validated.success) return validated.response;
    const { city, state, country, privacy } = validated.data;

    // Sanitize inputs (trim whitespace, convert empty to null)
    const sanitize = (val: string | null | undefined): string | null => {
      if (!val) return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        location_city: sanitize(city),
        location_state: sanitize(state),
        location_country: sanitize(country),
        location_privacy: privacy || "state_country",
      })
      .eq("clerk_user_id", userId)
      .select("location_city, location_state, location_country, location_privacy")
      .single();

    if (error) {
      console.error("Error updating location:", error);
      return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }

    return NextResponse.json({
      city: profile?.location_city || null,
      state: profile?.location_state || null,
      country: profile?.location_country || null,
      privacy: profile?.location_privacy || "state_country",
    } as UserLocation);
  } catch (error) {
    console.error("Location update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
