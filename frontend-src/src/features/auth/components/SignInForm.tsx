import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../../../shared/components/ui/Input";
import { Button } from "../../../shared/components/ui/Button";
import { Checkbox } from "../../../shared/components/ui/Checkbox";
import type { SignInFormData } from "../types";

interface SignInFormProps {
  onSubmit: (data: SignInFormData) => void;
  onSignUpClick: () => void;
  onForgotPasswordClick: () => void;
  isLoading?: boolean;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  onSubmit,
  onSignUpClick,
  onForgotPasswordClick,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange =
    (field: keyof SignInFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]:
          e.target.type === "checkbox" ? e.target.checked : e.target.value,
      }));
    };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      {/* Email Input */}
      <Input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange("email")}
        required
        autoComplete="email"
        disabled={isLoading}
      />

      {/* Password Input */}
      <Input
        type={showPassword ? "text" : "password"}
        placeholder="Password"
        value={formData.password}
        onChange={handleChange("password")}
        required
        autoComplete="current-password"
        disabled={isLoading}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer disabled:cursor-not-allowed"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between pt-1">
        <Checkbox
          label="Remember me"
          checked={formData.rememberMe}
          onChange={handleChange("rememberMe")}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={onForgotPasswordClick}
          className="text-sm underline text-gray-600 hover:text-primary-dark transition-colors font-medium cursor-pointer disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          Forgot password?
        </button>
      </div>

      {/* Sign In Button */}
      <Button
        type="submit"
        variant="primary"
        className="w-full mt-4 font-semibold"
        isLoading={isLoading}
      >
        Sign In
      </Button>

      {/* Sign Up Link */}
      <div className="text-center text-sm text-text-secondary pt-1 mb-10 select-none">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onSignUpClick}
          className="text-primary hover:text-primary-dark font-normal transition-colors cursor-pointer disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          Sign Up
        </button>
      </div>
    </form>
  );
};

