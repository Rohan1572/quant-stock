import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6 text-destructive">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
      <h2 className="text-xl font-semibold mb-6 text-muted-foreground">Resource not found</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        The stock or page you're looking for doesn't exist or is currently unavailable in our database.
      </p>
      <Link href="/">
        <Button size="lg" className="font-bold">
          Return to Terminal
        </Button>
      </Link>
    </div>
  );
}
