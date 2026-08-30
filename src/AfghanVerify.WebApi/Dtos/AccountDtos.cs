using System.ComponentModel.DataAnnotations;

namespace AfghanVerify.WebApi.Dtos;

public sealed record ChangeOwnPasswordDto(
    [param: Required] string CurrentPassword,
    [param: Required, MinLength(8), StringLength(128)] string NewPassword);
