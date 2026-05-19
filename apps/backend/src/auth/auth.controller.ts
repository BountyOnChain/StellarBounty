import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, ChallengeDto, AuthResponseDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Request a challenge to sign with Freighter',
    description:
      'Generate a challenge message that the user must sign with their Stellar wallet (Freighter) to prove ownership of the public key.',
  })
  @ApiResponse({
    status: 200,
    description: 'Challenge generated successfully',
    type: ChallengeDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid public key format' })
  getChallenge(
    @Body('publicKey') publicKey: string,
  ): ChallengeDto {
    return this.authService.generateChallenge(publicKey);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Verify signature and receive JWT',
    description:
      'Submit the signed challenge message to verify wallet ownership and receive a JWT access token valid for 24 hours.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid signature or expired challenge',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.verifyAndLogin(
      loginDto.publicKey,
      loginDto.signature,
    );
  }
}
