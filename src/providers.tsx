import { HeroUIProvider } from "@heroui/system";

export default function Providers({ children }: { children: React.ReactNode }) {
    return <HeroUIProvider>{children}</HeroUIProvider>;
}
