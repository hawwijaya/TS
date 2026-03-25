using System;
using System.Net.Http;
using System.Threading.Tasks;
class P {
    static async Task Main() {
        var handler = new HttpClientHandler();
        handler.ServerCertificateCustomValidationCallback = (m,c,ch,e) => true;
        using var client = new HttpClient(handler);
        client.DefaultRequestHeaders.Add("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQVBJIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvaGFzaCI6IjViOXQ2czdzNjc4ZzI4c21yaDRuIiwiaHR0cDovL3R5cmVzZW5zZS5jb20vY2xhaW1zL2NsaWVudGlkIjoiMjYiLCJuYmYiOjE3NjkwMzk5ODYsImV4cCI6NDkyNDc5OTk4NiwiaWF0IjoxNzY5MDM5OTg2LCJpc3MiOiJUeXJlU2Vuc2UifQ.dg3qRzA3yk1iXYWbvQG4C9XA1A6waDgPWq5MR4g0QuQ");
        client.Timeout = TimeSpan.FromSeconds(15);
        try {
            var resp = await client.GetAsync("https://app.tyresense.com/da/areas");
            Console.WriteLine("Status: " + (int)resp.StatusCode);
            var body = await resp.Content.ReadAsStringAsync();
            Console.WriteLine("Body: " + body.Substring(0, Math.Min(500, body.Length)));
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
            if (ex.InnerException != null) Console.WriteLine("Inner: " + ex.InnerException.Message);
            if (ex.InnerException?.InnerException != null) Console.WriteLine("Inner2: " + ex.InnerException.InnerException.Message);
        }
    }
}
