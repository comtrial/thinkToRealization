import { z } from "zod";

export const registerSchema = z.object({
  email: z.email("유효한 이메일을 입력해주세요"),
  name: z.string().min(1, "이름을 입력해주세요").max(50),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").max(100),
});

export const loginSchema = z.object({
  email: z.email("유효한 이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});
