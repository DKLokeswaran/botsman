import { APP_NAME as DEFAULT_NAME } from "@botsman/client-core";
import Constants from "expo-constants";

// The name in app.json, which a preview build changes to Botsman Preview.
export const APP_NAME = Constants.expoConfig?.name ?? DEFAULT_NAME;
