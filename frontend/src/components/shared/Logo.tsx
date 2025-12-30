import { VulnCraftLogoLight as VulnCraftLogoLightAsset } from "@/assets";
import { cn } from "@/lib/utils";

interface VulnCraftLogoProps {
  className?: string;
}

const VulnCraftLogo = ({ className }: VulnCraftLogoProps) => {
  return (
    <img
      src={VulnCraftLogoLightAsset}
      alt="VulnCraft Logo"
      className={cn(className)}
    />
  );
};

export default VulnCraftLogo;
