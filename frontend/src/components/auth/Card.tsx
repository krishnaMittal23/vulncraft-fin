import { Card, CardContent } from "@/components/ui/card";
import { PieChart } from "lucide-react";

export const MetricsCard = () => {
  return (
    <Card className="absolute bottom-10 -right-8 w-[270px]">
      <CardContent>
        <div className="flex justify-between items-start">
          <PieChart className="h-8 w-8" />
          <div className="text-left">
            <h3 className="text-green-600 text-base font-bold">↑ 18%</h3>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold">Security Issues Fixed</p>
          <p className="text-black dark:text-white text-xl font-bold">1M+</p>
        </div>
      </CardContent>
    </Card>
  );
};
