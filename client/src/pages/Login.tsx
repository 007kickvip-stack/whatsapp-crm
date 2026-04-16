import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Loader2, User, Lock, ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  // Fetch captcha
  const captchaQuery = trpc.auth.getCaptcha.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // When captcha data loads, store the token
  const currentToken = captchaQuery.data?.token;
  if (currentToken && currentToken !== captchaToken) {
    setCaptchaToken(currentToken);
  }

  const refreshCaptcha = useCallback(() => {
    setCaptchaCode("");
    captchaQuery.refetch();
  }, [captchaQuery]);

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      toast.success("登录成功");
      window.location.href = "/";
    },
    onError: (err) => {
      toast.error(err.message || "登录失败");
      // Refresh captcha after failed attempt
      refreshCaptcha();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("请输入用户名和密码");
      return;
    }
    if (!captchaCode.trim()) {
      toast.error("请输入验证码");
      return;
    }
    if (!captchaToken) {
      toast.error("验证码加载失败，请刷新");
      return;
    }
    loginMutation.mutate({
      username: username.trim(),
      password,
      captchaToken,
      captchaCode: captchaCode.trim(),
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50/30">
      <div className="w-full max-w-md px-4">
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              WhatsApp CRM
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              客户管理与订单系统
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="captcha" className="text-sm font-medium">验证码</Label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="captcha"
                      type="text"
                      placeholder="请输入验证码"
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                      className="pl-10 h-11 uppercase tracking-widest"
                      maxLength={4}
                      autoComplete="off"
                    />
                  </div>
                  <div
                    className="h-11 w-[140px] rounded-md border border-input bg-background cursor-pointer flex items-center justify-center overflow-hidden hover:border-emerald-400 transition-colors group relative shrink-0"
                    onClick={refreshCaptcha}
                    title="点击刷新验证码"
                  >
                    {captchaQuery.isLoading || captchaQuery.isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : captchaQuery.data?.svg ? (
                      <>
                        <div
                          dangerouslySetInnerHTML={{ __html: captchaQuery.data.svg }}
                          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">加载失败，点击重试</span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {loginMutation.isPending ? "登录中..." : "登录"}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">或</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
            >
              使用 Manus 账号登录
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          如需账号，请联系管理员创建
        </p>
      </div>
    </div>
  );
}
