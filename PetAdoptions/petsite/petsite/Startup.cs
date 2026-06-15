using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Prometheus;

namespace PetSite
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
            new ConfigurationBuilder()
                .AddEnvironmentVariables()
                .Build();
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllersWithViews();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILoggerFactory loggerFactory)
        {
            app.UseXRay("PetSite", Configuration);

            // Structured per-request log line carrying service / AZ / instance / node
            // and request latency, so FIS fault impact (AZ outage, instance kill,
            // injected latency) can be attributed and measured from PetSite's logs.
            //
            // The line is written as a raw flat JSON object via Console.WriteLine
            // (rather than ILogger.LogInformation, whose JSON console formatter
            // nests every field under a "State" object). The Container Insights
            // Fluent Bit DaemonSet re-parses stdout JSON under "log_processed", so
            // a flat object yields top-level fields ($.log_processed.latency_ms,
            // $.log_processed.node, ...) matching the Python EKS services and
            // letting one set of Contributor Insights rules key on them.
            app.Use(async (context, next) =>
            {
                var sw = Stopwatch.StartNew();
                // Expose the stopwatch to the view layer so the footer "served by"
                // badge can read elapsed-so-far at render time (the request log
                // line below captures the final total). The badge makes
                // FIS-injected latency visible in the page itself.
                context.Items["RequestStopwatch"] = sw;
                string errMsg = "";
                try
                {
                    await next();
                }
                catch (Exception ex)
                {
                    // Record the failure on the request line, then re-throw so the
                    // rest of the pipeline (error pages) is unchanged.
                    errMsg = ex.GetType().Name + ": " + ex.Message;
                    throw;
                }
                finally
                {
                    sw.Stop();
                    var traceId = Amazon.XRay.Recorder.Core.AWSXRayRecorder.Instance?.TraceContext?
                        .GetEntity()?.RootSegment?.TraceId ?? "";
                    var line = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        @event = "request",
                        service = RuntimeContext.Service,
                        az = RuntimeContext.AvailabilityZone,   // "" on EKS; rank by node
                        instance = RuntimeContext.Instance,
                        node = RuntimeContext.Node,
                        path = context.Request.Path.Value,
                        status = context.Response?.StatusCode ?? 0,
                        latency_ms = sw.ElapsedMilliseconds,
                        bytes = context.Response?.ContentLength ?? 0,
                        err = errMsg,
                        trace_id = traceId
                    });
                    Console.WriteLine(line);
                }
            });

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseExceptionHandler("/Home/Error");
                app.UseHsts();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();

            app.UseRouting();
            app.UseHttpMetrics();

            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllerRoute(
                    name: "default",
                    pattern: "{controller=Home}/{action=Index}/{id?}");
                endpoints.MapMetrics();
            });
        }
    }
}