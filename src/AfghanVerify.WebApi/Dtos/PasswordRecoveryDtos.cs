using System.ComponentModel.DataAnnotations;

namespace AfghanVerify.WebApi.Dtos;

public sealed record ForgotPasswordRequestDto(
    [param: Required, EmailAddress, StringLength(256)] string Email);

public sealed record ResetPasswordRequestDto(
    [param: Required, EmailAddress, StringLength(256)] string Email,
    [param: Required, StringLength(4096)] string Token,
    [param: Required, MinLength(8), StringLength(128)] string NewPassword);
