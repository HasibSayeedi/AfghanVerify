using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace AfghanVerify.WebApi.Services;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception,
        CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled API exception for {Method} {Path}. Trace ID: {TraceId}",
            context.Request.Method, context.Request.Path, context.TraceIdentifier);

        var databaseUnavailable = ContainsSqlException(exception);
        var status = databaseUnavailable
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status500InternalServerError;
        var title = databaseUnavailable ? "Database service unavailable" : "Request processing failed";
        var detail = databaseUnavailable
            ? "The credential database is temporarily unavailable. Please retry after the database connection has been restored."
            : "An unexpected server error occurred. Please retry or contact the system administrator with the trace ID.";

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path,
            Extensions = { ["traceId"] = context.TraceIdentifier }
        }, cancellationToken);
        return true;
    }

    private static bool ContainsSqlException(Exception? exception)
    {
        while (exception is not null)
        {
            if (exception is SqlException) return true;
            exception = exception.InnerException;
        }
        return false;
    }
}
