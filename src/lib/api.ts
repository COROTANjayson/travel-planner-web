"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export interface ApiUser {
  id: number;
  email: string | null;
  display_name: string;
  created_at: string;
  updated_at: string;
}

const messages: Partial<Record<number, string>> = {
  403: "You do not have permission to access this resource.",
  404: "The requested resource was not found.",
  409: "This data changed. Refresh and try again.",
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function useApi() {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const queryClient = useQueryClient();

  return useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T | undefined> => {
      const reauthenticate = async (): Promise<never> => {
        queryClient.clear();
        await loginWithRedirect();
        throw new ApiError(401, "Your session expired. Signing you in again.");
      };

      let token: string | undefined;
      try {
        token = await getAccessTokenSilently();
      } catch {
        await reauthenticate();
      }

      if (!token) {
        await reauthenticate();
      }

      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);

      const response = await fetch(path, { ...init, headers });

      if (response.status === 401) {
        await reauthenticate();
      }

      if (!response.ok) {
        let message = messages[response.status];

        if (!message && response.status < 500) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          message = body?.error;
        }

        throw new ApiError(
          response.status,
          message ?? "Something went wrong. Please try again.",
        );
      }

      if (response.status === 204) return undefined;
      return (await response.json()) as T;
    },
    [getAccessTokenSilently, loginWithRedirect, queryClient],
  );
}
