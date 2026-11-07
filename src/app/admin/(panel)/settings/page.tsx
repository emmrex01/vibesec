import { SettingsForm } from "@/components/dashboard/settings-form";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Values saved here override the environment defaults across the website, emails and PDF reports.</p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
