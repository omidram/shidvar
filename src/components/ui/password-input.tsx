"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative min-w-0">
      <Input {...props} type={show ? "text" : "password"} className={cn("pe-12", className)} />
      <button
        type="button"
        className="absolute inset-y-0 end-1 grid w-11 place-items-center text-muted"
        aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}
        onClick={() => setShow((value) => !value)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
