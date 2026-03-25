using System;
using System.Net.Http;
using System.Net.Security;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        var handler = new HttpClientHandler();
        handler.ServerCertificateCustomValidationCallback = (msg, cert, chain, errors) => true;
        handler.SslProtocols = System.Security.Authentication.SslProtocols.Tls12;
        
        using var client = new HttpClient(handler);
        client.Timeout = TimeSpan.FromSeconds(15);
        
        var token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQVBJIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvaGFzaCI6IjViOXQ2czdzNjc4ZzI4c21yaDRuIiwiaHR0cDovL3R5cmVzZW5zZS5jb20vY2xhaW1zL2NsaWVudGlkIjoiMjYiLCJuYmYiOjE3NjkwMzk5ODYsImV4cCI6NDkyNDc5OTk4NiwiaWF0IjoxNzY5MDM5OTg2LCJpc3MiOiJUeXJlU2Vuc2UifQ.dg3qRzA3yk1iXYWbvQG4C9XA1A6waDgPWq5MR4g0QuQ";
        
        try {
            var resp = await client.GetAsync("https://app.tyresense.com/da/areas?access_token=" + token);
            Console.WriteLine("Status: " + (int)resp.StatusCode);
            var body = await resp.Content.ReadAsStringAsync();
            Console.WriteLine(body);
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
            if (ex.InnerException != null) {
                Console.WriteLine("Inner: " + ex.InnerException.Message);
                if (ex.InnerException.InnerException != null)
                    Console.WriteLine("Inner2: " + ex.InnerException.InnerException.Message);
            }
        }
    }
}
