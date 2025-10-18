// hero.ts
import { heroui } from "@heroui/theme";
export default heroui({
    defaultTheme: "dark",
    themes: {
        dark: {
            colors: {
                primary: {
                    50: "hsl(219 90.9% 95.7% / <alpha-value>)",
                    100: "hsl(218 91.1% 91.2% / <alpha-value>)",
                    200: "hsl(216 90.9% 82.7% / <alpha-value>)",
                    300: "hsl(212.5 90.3% 71.6% / <alpha-value>)",
                    400: "hsl(207.3 86.3% 57.1% / <alpha-value>)",
                    500: "hsl(207.5 66.2% 46.5% / <alpha-value>)",
                    600: "hsl(207.2 68.1% 36.9% / <alpha-value>)",
                    700: "hsl(207 70.4% 27.8% / <alpha-value>)",
                    800: "hsl(207.6 75.5% 19.2% / <alpha-value>)",
                    900: "hsl(208.1 85.5% 10.8% / <alpha-value>)",
                },
            },
        },
    },
});
