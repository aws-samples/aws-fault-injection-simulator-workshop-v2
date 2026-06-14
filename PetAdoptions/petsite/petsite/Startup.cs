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
            var reqLogger = loggerFactory.CreateLogger("PetSite.Request");
            app.Use(async (context, next) =>
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    await next();
                }
                finally
                {
                    sw.Stop();
                    var traceId = Amazon.XRay.Recorder.Core.AWSXRayRecorder.Instance?.TraceContext?
                        .GetEntity()?.RootSegment?.TraceId ?? "";
                    reqLogger.LogInformation(
                        "request service={Service} az={AZ} instance={Instance} node={Node} method={Method} path={Path} status={Status} latency_ms={LatencyMs} traceId={TraceId}",
                        RuntimeContext.Service, RuntimeContext.AvailabilityZone, RuntimeContext.Instance,
                        RuntimeContext.Node, context.Request.Method, context.Request.Path.Value,
                        context.Response?.StatusCode, sw.ElapsedMilliseconds, traceId);
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