import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../../../shared/components/ui/Input";
import { Button } from "../../../shared/components/ui/Button";
import { Checkbox } from "../../../shared/components/ui/Checkbox";
import type { SignUpFormData } from "../types";

interface SignUpFormProps {
  onSubmit: (data: SignUpFormData) => void;
  onSignInClick: () => void;
  isLoading?: boolean;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<SignUpFormData>({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.username) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the Terms of Service";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange =
    (field: keyof SignUpFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]:
          e.target.type === "checkbox" ? e.target.checked : e.target.value,
      }));
      // Clear error for this field when user starts typing
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {/* Email Input */}
      <div className="space-y-1">
        <Input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange("email")}
          required
          autoComplete="email"
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email}</p>
        )}
      </div>

      {/* Username Input */}
      <div className="space-y-1">
        <Input
          type="text"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange("username")}
          required
          disabled={isLoading}
        />
        {errors.username && (
          <p className="text-sm text-red-500">{errors.username}</p>
        )}
      </div>

      {/* Password Input */}
      <div className="space-y-1">
        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={formData.password}
          onChange={handleChange("password")}
          required
          autoComplete="new-password"
          disabled={isLoading}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer disabled:cursor-not-allowed"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password}</p>
        )}
      </div>

      {/* Confirm Password Input */}
      <div className="space-y-1">
        <Input
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange("confirmPassword")}
          required
          autoComplete="new-password"
          disabled={isLoading}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer disabled:cursor-not-allowed"
              tabIndex={-1}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-500">{errors.confirmPassword}</p>
        )}
      </div>

      {/* Terms & Privacy Agreement */}
      <div className="space-y-1 pt-2">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={formData.agreeToTerms}
            onChange={handleChange("agreeToTerms")}
            disabled={isLoading}
          />
          <span className="text-sm">
            I agree to the{" "}
            <a
              href="#"
              className="text-primary hover:text-primary-dark underline font-normal"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-primary hover:text-primary-dark underline font-normal"
            >
              Data Privacy Policy
            </a>
          </span>
        </div>
        {errors.agreeToTerms && (
          <p className="text-sm text-red-500">{errors.agreeToTerms}</p>
        )}
      </div>

      {/* Create Account Button */}
      <Button
        type="submit"
        variant="primary"
        className="w-full mt-6"
        isLoading={isLoading}
      >
        Create Account
      </Button>
    </form>
  );
};
