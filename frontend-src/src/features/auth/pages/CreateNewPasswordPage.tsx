import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../../../shared/components/ui/Input";
import { Button } from "../../../shared/components/ui/Button";

export const CreateNewPasswordPage: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState<string | undefined>(undefined);

  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(undefined);

    // Demo only — replace later with API call
    alert("Password updated (demo).");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-lg border border-gray-100 p-10">
        <h1 className="text-4xl font-medium text-gray-800 select-none">
          Create new password
        </h1>
        <p className="mt-2 text-base text-text-secondary select-none">
          Enter your new password below
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 select-none">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <Input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <Button type="submit" variant="primary" className="w-full mt-4">
            Reset Password
          </Button>

          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => navigate("/signin")}
              className="text-sm text-primary hover:text-primary-dark transition-colors cursor-pointer font-normal"
            >
              Back to Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
