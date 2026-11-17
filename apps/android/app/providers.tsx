import { Note, Page } from "../src/ui/page";
import { ProviderList } from "../src/ui/provider-list";

// Every model provider with its status, and the ways to connect, replace, or remove one. Saved keys are never shown.
export default function ProvidersScreen() {
  return (
    <Page title="Model providers">
      <Note>Keys and sign-ins are stored on the server, sealed, and can't be viewed again.</Note>
      <ProviderList />
    </Page>
  );
}
