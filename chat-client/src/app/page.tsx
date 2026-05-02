import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center tracking-tight">Chat Client UI</h1>
        <p className="text-sm opacity-80 mb-6 text-center">
          Verifying glassmorphism and UI components.
        </p>
        <div className="space-y-4">
          <Input label="Test Input" placeholder="Enter something..." />
          <Button className="w-full">Get Started</Button>
          <Button variant="secondary" className="w-full">Settings</Button>
        </div>
      </Card>
    </div>
  );
}
