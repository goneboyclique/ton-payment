import { createZodDto } from 'nestjs-zod';
import { UserFindUniqueZodSchema, UserSchema } from '@pkg/db/schemas';

const UserResSchema = UserSchema.pick({
  id: true,
  first_name: true,
  last_name: true,
  photo_url: true,
  username: true,
  ton_wallet_address: true,
  is_premium: true,
}).partial();

export class UserUpdateTonAccountAddressDto extends createZodDto(
  UserSchema.pick({ ton_wallet_address: true }),
) {}

export class UserFindByIdDto extends createZodDto(
  UserSchema.pick({ id: true }),
) {}

export class UserResDto extends createZodDto(UserResSchema) {}
