import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Phone, Mail, Lock, User, ArrowRight, Eye, EyeOff, Loader2, Building2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// Format phone number as user types: +1 (XXX) XXX-XXXX
function formatPhoneNumber(value: string): string {
  // Strip all non-digits except leading +
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return hasPlus ? '+' : '';
  
  // Handle US format (11 digits starting with 1, or 10 digits)
  let formatted = '';
  
  if (digits.length >= 1) {
    // Check if starts with country code 1
    const hasCountryCode = digits.startsWith('1') && digits.length > 10;
    const countryCode = hasCountryCode ? digits[0] : (digits.length <= 10 ? '' : digits[0]);
    const remaining = hasCountryCode ? digits.slice(1) : (digits.length <= 10 ? digits : digits.slice(1));
    
    if (countryCode) {
      formatted = `+${countryCode} `;
    } else if (hasPlus || digits.length > 10) {
      formatted = '+1 ';
    }
    
    // Format area code
    if (remaining.length > 0) {
      const areaCode = remaining.slice(0, 3);
      if (remaining.length <= 3) {
        formatted += `(${areaCode}`;
      } else {
        formatted += `(${areaCode}) `;
      }
    }
    
    // Format exchange
    if (remaining.length > 3) {
      const exchange = remaining.slice(3, 6);
      formatted += exchange;
    }
    
    // Format subscriber
    if (remaining.length > 6) {
      const subscriber = remaining.slice(6, 10);
      formatted += `-${subscriber}`;
    }
  }
  
  return formatted;
}

// Validate phone number format
function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

// Get just the digits for storage (E.164 format)
function getPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  // Ensure it starts with country code
  if (digits.length === 10) {
    return '+1' + digits;
  }
  return '+' + digits;
}

// Validation schemas
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Name is required" })
      .max(100, { message: "Name must be less than 100 characters" }),
    organizationName: z
      .string()
      .trim()
      .min(1, { message: "Organization name is required" })
      .max(100, { message: "Organization name must be less than 100 characters" }),
    email: z
      .string()
      .trim()
      .min(1, { message: "Email is required" })
      .email({ message: "Please enter a valid email address" })
      .max(255, { message: "Email must be less than 255 characters" }),
    phone: z
      .string()
      .trim()
      .min(1, { message: "Phone number is required" })
      .refine((val) => isValidPhoneNumber(val), { message: "Please enter a valid 10-digit phone number" }),
    password: z
      .string()
      .min(1, { message: "Password is required" })
      .min(8, { message: "Password must be at least 8 characters" })
      .max(128, { message: "Password must be less than 128 characters" })
      .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
      .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
      .regex(/[0-9]/, { message: "Password must contain at least one number" }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

type SignupStep = 'form' | 'verify-email' | 'complete';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login, signup, isAuthenticated } = useAuth();

  // Check for signup query param
  const searchParams = new URLSearchParams(location.search);
  const shouldSignup = searchParams.get('signup') === 'true';

  const [isLogin, setIsLogin] = useState(!shouldSignup);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Signup flow state
  const [signupStep, setSignupStep] = useState<SignupStep>('form');
  const [signupData, setSignupData] = useState<SignupFormData | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      organizationName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      
      if (result.error) {
        toast({
          title: "Login failed",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate(from, { replace: true });
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = loginForm.getValues("email");
    
    if (!email || !email.includes("@")) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your email",
          description: "We've sent you a password reset link.",
        });
      }
    } catch (error) {
      toast({
        title: "Reset failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const sendVerificationCode = async (type: 'email' | 'phone', value: string) => {
    setIsSendingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification', {
        body: { type, [type]: value }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to send code');
      }

      toast({
        title: "Code sent!",
        description: `We've sent a verification code to your ${type === 'email' ? 'email' : 'phone'}.`,
      });
      setResendCountdown(60);
    } catch (error: any) {
      toast({
        title: "Failed to send code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyCode = async (type: 'email' | 'phone', code: string, value: string): Promise<boolean> => {
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { type, code, [type]: value }
      });

      if (error || !data?.success) {
        toast({
          title: "Invalid code",
          description: data?.error || "Please check the code and try again.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const onSignupFormSubmit = async (data: SignupFormData) => {
    setSignupData(data);
    // Start with email verification
    await sendVerificationCode('email', data.email);
    setSignupStep('verify-email');
  };

  const handleEmailVerification = async () => {
    if (!signupData || emailCode.length !== 6) return;
    
    const verified = await verifyCode('email', emailCode, signupData.email);
    if (verified) {
      // Email verified, complete signup (no phone verification needed)
      await completeSignup();
    }
  };


  const completeSignup = async () => {
    if (!signupData) return;
    
    setIsLoading(true);
    try {
      const result = await signup(signupData.email, signupData.password, signupData.name, signupData.organizationName);
      
      if (result.error) {
        toast({
          title: "Signup failed",
          description: result.error,
          variant: "destructive",
        });
        setSignupStep('form');
        setIsLoading(false);
        return;
      }
      
      toast({
        title: "Account created!",
        description: "Welcome to the dashboard!",
      });

      // In development mode, skip Edge Function provisioning
      // Users should manually create organization via SQL
      const isDevelopment = import.meta.env.MODE === 'development' || !import.meta.env.PROD;

      if (isDevelopment) {
        toast({
          title: "Development Mode",
          description: "Please set up your organization manually via SQL.",
        });
        navigate(from, { replace: true });
        return;
      }

      // Get session for provisioning (production only)
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        // First, provision the organization with phone number for notifications
        const { data: provisionData, error: provisionError } = await supabase.functions.invoke(
          'provision-organization',
          {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: {
              organizationName: signupData.organizationName,
              notificationPhone: getPhoneDigits(signupData.phone),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          }
        );

        if (provisionError) {
          console.error('Provisioning error:', provisionError);
          toast({
            title: "Setup issue",
            description: "There was an issue setting up your organization. Please contact support.",
            variant: "destructive",
          });
          navigate(from, { replace: true });
          return;
        }

        console.log('Organization provisioned:', provisionData);

        toast({
          title: "Organization ready!",
          description: "Let's choose your plan...",
        });

        // Redirect to plan selection page
        navigate('/onboarding/select-plan', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: "Signup failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setSignupStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  const renderVerificationStep = (
    type: 'email' | 'phone',
    code: string,
    setCode: (value: string) => void,
    onVerify: () => void,
    value: string
  ) => (
    <motion.div
      key={`verify-${type}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <button
        type="button"
        onClick={() => setSignupStep(type === 'email' ? 'form' : 'verify-email')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          {type === 'email' ? (
            <Mail className="w-8 h-8 text-primary" />
          ) : (
            <Phone className="w-8 h-8 text-primary" />
          )}
        </div>
        <h2 className="text-xl font-semibold">
          Verify your {type === 'email' ? 'email' : 'phone number'}
        </h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-foreground">
            {type === 'email' ? value : `***${value.slice(-4)}`}
          </span>
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        type="button"
        variant="hero"
        size="lg"
        className="w-full"
        disabled={code.length !== 6 || isVerifying}
        onClick={onVerify}
      >
        {isVerifying ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            Verify & Continue
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn't receive the code?{' '}
        {resendCountdown > 0 ? (
          <span>Resend in {resendCountdown}s</span>
        ) : (
          <button
            type="button"
            onClick={() => sendVerificationCode(type, type === 'phone' ? getPhoneDigits(value) : value)}
            disabled={isSendingCode}
            className="text-primary hover:underline font-medium"
          >
            {isSendingCode ? 'Sending...' : 'Resend'}
          </button>
        )}
      </p>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-hero shadow-glow">
              <Phone className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              Answer<span className="text-gradient">After</span>
            </span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2">
              {isLogin 
                ? "Welcome back" 
                : signupStep === 'form' 
                  ? "Create your account"
                  : signupStep === 'verify-email'
                    ? "Verify your email"
                    : "Almost done!"
              }
            </h1>
            <p className="text-muted-foreground">
              {isLogin
                ? "Enter your credentials to access your dashboard"
                : signupStep === 'form'
                  ? "Start capturing every after-hours opportunity"
                  : "Enter the verification code to continue"
              }
            </p>
          </div>

          {/* Tab Switcher - only show on form step */}
          {signupStep === 'form' && (
            <div className="flex bg-muted rounded-lg p-1 mb-8">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  isLogin
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Log In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  !isLogin
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Progress indicator for signup */}
          {!isLogin && signupStep !== 'form' && (
            <div className="flex items-center gap-2 mb-8">
              <div className={`flex-1 h-1 rounded-full ${signupStep === 'verify-email' || signupStep === 'complete' ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`flex-1 h-1 rounded-full ${signupStep === 'complete' ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          )}

          {/* Forms */}
          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={loginForm.handleSubmit(onLogin)}
                className="space-y-5"
              >
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10 h-12"
                      {...loginForm.register("email")}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isResettingPassword}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      {isResettingPassword ? "Sending..." : "Forgot password?"}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-12"
                      {...loginForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : signupStep === 'form' ? (
              <motion.form
                key="signup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={signupForm.handleSubmit(onSignupFormSubmit)}
                className="space-y-5"
              >
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Smith"
                      className="pl-10 h-12"
                      {...signupForm.register("name")}
                    />
                  </div>
                  {signupForm.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                {/* Organization Name */}
                <div className="space-y-2">
                  <Label htmlFor="signup-org">Organization Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="signup-org"
                      type="text"
                      placeholder="Acme Plumbing Co."
                      className="pl-10 h-12"
                      {...signupForm.register("organizationName")}
                    />
                  </div>
                  {signupForm.formState.errors.organizationName && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.organizationName.message}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10 h-12"
                      {...signupForm.register("email")}
                    />
                  </div>
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      className={`pl-10 h-12 ${signupForm.watch("phone") && !isValidPhoneNumber(signupForm.watch("phone")) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      value={signupForm.watch("phone")}
                      onChange={(e) => signupForm.setValue("phone", formatPhoneNumber(e.target.value), { shouldValidate: true })}
                    />
                  </div>
                  {signupForm.formState.errors.phone && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-12"
                      {...signupForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {signupForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-12"
                      {...signupForm.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {signupForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* $1 First Month Promo */}
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-accent mb-1">🎉 $1 First Month</p>
                  <p className="text-xs text-muted-foreground">
                    Start with your first month for just $1. Cancel anytime.
                  </p>
                </div>

                {/* Terms */}
                <p className="text-sm text-muted-foreground">
                  By signing up, you agree to our{" "}
                  <a href="#" className="text-primary hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-primary hover:underline">
                    Privacy Policy
                  </a>
                  .
                </p>

                {/* Submit */}
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={isLoading || isSendingCode}
                >
                  {isSendingCode ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending verification...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : signupStep === 'verify-email' && signupData ? (
              renderVerificationStep('email', emailCode, setEmailCode, handleEmailVerification, signupData.email)
            ) : null}
          </AnimatePresence>

          {/* Footer */}
          {signupStep === 'form' && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-medium hover:underline"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </p>
          )}
        </motion.div>
      </div>

      {/* Right Panel - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-hero relative overflow-hidden">
        {/* Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23fff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 flex flex-col justify-center items-center p-16 text-center">
          {/* Floating Elements */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 right-20"
          >
            <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
              <Phone className="w-8 h-8 text-primary-foreground" />
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/4 left-20"
          >
            <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
              <Mail className="w-8 h-8 text-primary-foreground" />
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="w-20 h-20 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
              <Phone className="w-10 h-10 text-primary-foreground" />
            </div>

            <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">
              Never Miss a Call Again
            </h2>

            <p className="text-primary-foreground/80 max-w-sm mx-auto mb-8">
              Join thousands of service businesses that capture every after-hours opportunity with AI-powered call handling.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
              {[
                { value: "99.9%", label: "Uptime" },
                { value: "10K+", label: "Calls/day" },
                { value: "$2M+", label: "Captured" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm"
                >
                  <p className="font-display text-2xl font-bold text-primary-foreground">
                    {stat.value}
                  </p>
                  <p className="text-sm text-primary-foreground/70">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;