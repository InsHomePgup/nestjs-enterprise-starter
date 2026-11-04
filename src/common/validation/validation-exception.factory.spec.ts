import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsString,
  Min,
  MinLength,
  ValidateNested,
  validate,
} from 'class-validator';
import { ErrorCode } from '../constants/error-code.enum';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-exception.factory';

class Item {
  @IsInt()
  @Min(1)
  quantity: number;
}

class Order {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @ValidateNested({ each: true })
  @Type(() => Item)
  items: Item[];
}

async function errorsFor(input: object) {
  return validate(plainToInstance(Order, input));
}

describe('validation exception factory', () => {
  it('produces one { field, rule, message } entry per failed constraint', async () => {
    const details = flattenValidationErrors(
      await errorsFor({ email: 'nope', password: 'short', items: [] }),
    );
    expect(details).toEqual(
      expect.arrayContaining([
        { field: 'email', rule: 'isEmail', message: expect.any(String) },
        { field: 'password', rule: 'minLength', message: expect.any(String) },
      ]),
    );
  });

  it('uses dotted paths for nested objects and arrays', async () => {
    const details = flattenValidationErrors(
      await errorsFor({
        email: 'a@b.co',
        password: 'longenough',
        items: [{ quantity: 1 }, { quantity: 0 }],
      }),
    );
    expect(details).toEqual([
      { field: 'items.1.quantity', rule: 'min', message: expect.any(String) },
    ]);
  });

  it('wraps the details in a COMMON_VALIDATION_FAILED BusinessException', async () => {
    const exception = validationExceptionFactory(await errorsFor({}));
    expect(exception.code).toBe(ErrorCode.COMMON_VALIDATION_FAILED);
    expect(exception.getStatus()).toBe(400);
    expect(exception.details?.length).toBeGreaterThan(0);
  });
});
