export const APP_NAME = "Successor Protocol";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  DASHBOARD: "/dashboard",
  HEARTBEAT: "/heartbeat",
  MY_WILL: "/my-will",
  NEXT_OF_KIN: "/next-of-kin",
  ATTESTATIONS: "/attestations",
  SETTINGS: "/settings",
} as const;

export const HEARTBEAT_INTERVALS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
] as const;
