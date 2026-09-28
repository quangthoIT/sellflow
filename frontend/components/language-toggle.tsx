"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentLang = (i18n.language || "vi").substring(0, 2).toUpperCase();
  const titleText = currentLang === "VI" ? "Chuyển sang Tiếng Anh" : "Chuyển sang Tiếng Việt";

  const changeLanguage = (lang: "vi" | "en") => {
    i18n.changeLanguage(lang.toLowerCase());
    if (typeof window !== "undefined") {
      localStorage.setItem("vibe-lang", lang.toLowerCase());
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="outline"
        className="h-9 w-9 rounded-xl p-0 text-xs font-normal"
        aria-label="Chuyển đổi ngôn ngữ"
        title="Chuyển đổi ngôn ngữ"
      >
        VN
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={titleText}
          title={titleText}
          className="h-9 w-9 rounded-xl p-0 text-xs font-normal text-foreground hover:text-primary transition-colors"
        >
          {currentLang === "VI" ? "VN" : "EN"}
          <span className="sr-only">{titleText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => changeLanguage("vi")}
          className={currentLang === "VI" ? "font-semibold text-primary" : ""}
        >
          Tiếng Việt
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage("en")}
          className={currentLang === "EN" ? "font-semibold text-primary" : ""}
        >
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


