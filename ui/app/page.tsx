import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";

interface Stat {
  label: string;
  value: string | number;
  description?: string;
}

const stats: Stat[] = [
  { label: "Current Branch", value: "main", description: "Active git branch" },
  { label: "Tests Created", value: 142, description: "Total test cases" },
  { label: "Jira Tickets", value: 38, description: "Open tickets" },
  { label: "Tasks Completed", value: 89, description: "This sprint" },
  { label: "Docker Containers", value: 12, description: "Running containers" },
  { label: "API Endpoints", value: 24, description: "Registered routes" },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center p-8 gap-8">
      <span className="pixel-font text-2xl font-bold">Dashboard</span>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
        {stats.map((stat) => (
          <Card key={stat.label} className="w-full">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="pixel-font text-4xl font-bold">
                {stat.value}
              </div>
              {stat.description && (
                <p className="text-xs text-muted-foreground mt-2">
                  {stat.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}