import { MapPin, Clock, Camera, Video } from "lucide-react";
import { Badge } from "@/employees/components/ui/badge";
import { Card, CardContent } from "@/employees/components/ui/card";
import { getTrafficLight } from "@/employees/lib/trafficLight";

interface TaskCardProps {
  network: string;
  branch: string;
  workType: string;
  frequency: string;
  sidesRequired: number;
  sidesCompleted?: number;
  dueDate: string;
  status: string;
  requiresPhoto?: boolean;
  requiresVideo?: boolean;
}

const frequencyLabels: Record<string, string> = {
  one_time: "חד פעמי",
  monthly: "חודשי",
  quarterly: "רבעוני",
};

export function TaskCard({
  network,
  branch,
  workType,
  frequency,
  sidesRequired,
  sidesCompleted,
  dueDate,
  status,
  requiresPhoto,
  requiresVideo,
}: TaskCardProps) {
  const traffic = getTrafficLight(status, dueDate, frequency);

  return (
    <Card className="shadow-card hover:shadow-elevated transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">{network}</h3>
            <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>{branch}</span>
            </div>
          </div>
          <Badge className={traffic.className}>{traffic.label}</Badge>
        </div>

        <p className="text-sm text-foreground mb-2">{workType}</p>
        <p className="text-xs text-muted-foreground mb-2">{frequencyLabels[frequency] || frequency}</p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{dueDate}</span>
            </div>
            <span>
              צדדים: {sidesCompleted !== undefined ? `${sidesCompleted}/${sidesRequired}` : sidesRequired}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {requiresPhoto && <Camera className="h-4 w-4 text-muted-foreground" />}
            {requiresVideo && <Video className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
